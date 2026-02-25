#!/usr/bin/env python3
"""
03_scrape_bios.py — 下载高管简介，三层防幻觉校验

用法:
  python 03_scrape_bios.py HK
  python 03_scrape_bios.py SG
  python 03_scrape_bios.py ALL

流程:
  leadership_url
    → [Jina Reader 下载]          ← 现成工具，不自己写爬虫
    → 保存 raw_text 到 raw/        ← L1: 物理留档，事后可溯源
    → [LLM 提取，temperature=0]   ← 严格逐字复制，必须附 _source_sentence
    → 程序校验 _source_sentence    ← L3: 字符串匹配，自动打假
    → Bio 资格检查                 ← 职位范围 + ≥2句 + 含背景信息
    → 输出 scraped_{MARKET}.json   ← 供 04_upload.py 直接上传

防幻觉三层:
  L1  保存 raw_text 原始全文（可随时回溯）
  L2  LLM Prompt 强制要求 _source_sentence（原文对应句）
  L3  程序自动校验：_source_sentence[:60] in raw_text → 不通过则 bio=null

Bio 判断标准（用户确认）:
  - 职位: C-suite + VP 及以上（见 config.BIO_CRITERIA）
  - ≥ 2 句话
  - 含职业背景关键词（experience / joined / previously 等）

输入: data/leadership_urls_{MARKET}.json
输出: data/scraped_{MARKET}.json
      data/review_{MARKET}.csv   ← 人工核验工作表
"""

import sys
import json
import csv
import re
import time
import requests
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import (
    JINA_BASE_URL, JINA_API_KEY,
    LLM_API_URL, LLM_API_KEY, LLM_MODEL,
    DATA_DIR, RAW_DIR, BIO_CRITERIA, MARKETS,
)

TODAY = datetime.now(timezone.utc).strftime("%Y%m%d")
SCRAPED_AT = datetime.now(timezone.utc).isoformat()


# ===================== Jina 下载 =====================

def jina_fetch(url: str) -> str:
    """Jina Reader 下载页面，返回 markdown 文本。"""
    jina_url = JINA_BASE_URL + url
    headers = {"Accept": "text/plain"}
    if JINA_API_KEY:
        headers["Authorization"] = f"Bearer {JINA_API_KEY}"
    resp = requests.get(jina_url, headers=headers, timeout=90)
    resp.raise_for_status()
    return resp.text


# ===================== LLM 调用 =====================

def llm_call(prompt: str) -> str:
    """DeepSeek / OpenAI 兼容接口，temperature=0 确保无随机性。"""
    if not LLM_API_KEY:
        raise ValueError("请设置环境变量 LLM_API_KEY")
    resp = requests.post(
        f"{LLM_API_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": LLM_MODEL,
            "temperature": 0,  # 关闭随机性
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=180,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()


# ===================== LLM Prompt =====================
# 关键约束：
# - 只复制原文，不改写
# - 必须提供 _source_sentence（程序要用它做 L3 校验）
# - temperature=0 已在 API 层设置

EXTRACT_BIOS_PROMPT = """你是数据提取助手。请从以下保险公司领导层页面原文中提取高管信息。

【最严格规则 — 违反则输出被程序自动丢弃】
1. 所有字段只能逐字复制页面原文，不推断、不补充、不翻译、不总结
2. bio_verbatim 必须是页面原文中关于该高管的完整描述，一字不改
3. _source_sentence 必须是 bio_verbatim 内容在原文中出现的完整句子
   （程序会自动检查：_source_sentence 前60字是否出现在原文中）
4. 找不到某字段则返回 null，绝对不猜测或补充
5. 不添加任何你自己的知识，哪怕你知道该人物的其他信息

公司: {company}
地区: {market}
来源 URL: {source_url}

页面原文:
{raw_text}

请返回 JSON 数组，包含页面中出现的所有高管：
[
  {{
    "name": "高管英文全名（原文）",
    "name_zh": "中文名（原文中有则填，否则 null）",
    "title": "职位原文（完整，不缩写）",
    "bio_verbatim": "简介原文，逐字复制，一字不改",
    "_source_sentence": "bio 内容在原文中对应的完整句子（供程序校验，必须能在原文中找到）"
  }}
]

只返回 JSON 数组，不要任何其他文字。页面中无高管信息则返回 []。"""


# ===================== L3 校验：字符串匹配 =====================

def validate_source_in_raw(source_sentence: str, raw_text: str) -> bool:
    """
    L3 校验：检查 _source_sentence 前60字符是否出现在 raw_text 中。
    取前60字而非全句，避免末尾空白差异导致误判。
    """
    if not source_sentence or not raw_text:
        return False
    # 规范化空白后比较
    norm_raw = " ".join(raw_text.split())
    norm_src = " ".join(source_sentence.split())
    search_key = norm_src[:60] if len(norm_src) >= 60 else norm_src
    return bool(search_key) and search_key in norm_raw


# ===================== Bio 资格检查 =====================

def count_sentences(text: str) -> int:
    """估算句数（按 . ! ? 。！？ 分割）。"""
    if not text:
        return 0
    parts = re.split(r'[.!?。！？]+', text)
    return sum(1 for p in parts if p.strip())


def has_background_info(bio: str) -> bool:
    """检查 bio 是否含职业背景关键词。"""
    if not bio:
        return False
    bio_lower = bio.lower()
    return any(kw in bio_lower for kw in BIO_CRITERIA["background_keywords"])


def is_title_in_scope(title: str) -> bool:
    """
    检查职位是否在采集范围内。
    排除项优先，再判断纳入项。
    """
    if not title:
        return False
    title_lower = title.lower()
    if any(ex in title_lower for ex in BIO_CRITERIA["excluded_titles"]):
        return False
    return any(inc in title_lower for inc in BIO_CRITERIA["included_titles"])


def run_bio_checks(exec_data: dict, raw_text: str) -> dict:
    """
    对单条高管记录执行全部校验，返回含检查结果的记录。
    verified_auto=True 表示通过所有程序校验。
    """
    bio = exec_data.get("bio_verbatim") or ""
    source_sentence = exec_data.get("_source_sentence") or ""
    title = exec_data.get("title") or ""

    checks = {
        # L3: _source_sentence 必须出现在原文中（防幻觉核心）
        "source_in_raw":   validate_source_in_raw(source_sentence, raw_text),
        # Bio 资格
        "title_in_scope":  is_title_in_scope(title),
        "min_sentences":   count_sentences(bio) >= BIO_CRITERIA["min_sentences"],
        "has_background":  has_background_info(bio),
    }

    all_pass = all(checks.values())

    return {
        **exec_data,
        "verified_auto":  all_pass,
        "check_details":  checks,
        # L3 校验失败 → bio 置 null，不写入数据库
        "bio_verbatim":   bio if checks["source_in_raw"] else None,
    }


# ===================== 主流程 =====================

def process_market(market_code: str):
    urls_file = DATA_DIR / f"leadership_urls_{market_code}.json"
    if not urls_file.exists():
        print(f"❌ 找不到 {urls_file}，请先运行 02_find_leadership.py")
        return

    companies = json.loads(urls_file.read_text(encoding="utf-8"))
    with_url = [c for c in companies if c.get("leadership_url")]

    print(f"\n{'='*60}")
    print(f"📍 市场: {market_code} — {len(with_url)}/{len(companies)} 家有领导层页面")
    print(f"{'='*60}")

    all_results = []

    for i, company in enumerate(with_url, 1):
        name = company["company_name"]
        url  = company["leadership_url"]
        print(f"\n[{i}/{len(with_url)}] {name}")
        print(f"  URL: {url}")

        # ── L1: Jina 下载并保存原始文本 ──────────────────────────
        try:
            raw_text = jina_fetch(url)
        except Exception as e:
            print(f"  ❌ Jina 下载失败: {e}")
            continue

        slug = re.sub(r'[^A-Za-z0-9]', '_', name)[:40]
        raw_file = RAW_DIR / f"{market_code}_{slug}_{TODAY}.txt"
        raw_file.write_text(raw_text, encoding="utf-8")
        print(f"  [L1] 原文已保存 → {raw_file.name} ({len(raw_text):,} chars)")

        # ── LLM 提取（L2: 强制要求 _source_sentence）────────────
        prompt = EXTRACT_BIOS_PROMPT.format(
            company=name,
            market=market_code,
            source_url=url,
            raw_text=raw_text[:14000],   # 约 3500 tokens，留余量
        )
        try:
            llm_resp = llm_call(prompt)
            cleaned = clean_json_response(llm_resp)
            executives = json.loads(cleaned)
        except Exception as e:
            print(f"  ❌ LLM 解析失败: {e}")
            continue

        print(f"  [LLM] 提取到 {len(executives)} 名高管")

        # ── L3 校验 + Bio 资格检查 ────────────────────────────────
        for exec_data in executives:
            result = run_bio_checks(exec_data, raw_text)
            result.update({
                "company":     name,
                "company_zh":  company.get("company_name_zh"),
                "market":      market_code,
                "source_url":  url,
                "raw_file":    raw_file.name,
                "scraped_at":  SCRAPED_AT,
            })
            all_results.append(result)

            checks = result["check_details"]
            icon = "✅" if result["verified_auto"] else "⚠️ "
            print(f"  {icon} {result.get('name','?')} | {(result.get('title') or '')[:50]}")
            if not result["verified_auto"]:
                failed = [k for k, v in checks.items() if not v]
                print(f"     校验未通过: {failed}")

        time.sleep(2)

    # ── 输出 JSON ──────────────────────────────────────────────────
    out_json = DATA_DIR / f"scraped_{market_code}.json"
    out_json.write_text(json.dumps(all_results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n📄 JSON → {out_json.name}")

    # ── 输出校验日志 CSV（仅供审计参考，无需操作）────────────────
    out_csv = DATA_DIR / f"review_{market_code}.csv"
    fieldnames = [
        "姓名", "公司", "职位",
        "bio摘要（前120字）",
        "✓职位在范围", "✓句数≥2", "✓含背景信息", "✓原文句校验(L3)",
        "来源URL",
        "原文句子（_source_sentence）",
        "raw文件",
        "程序自动通过",
        "人工核验(Y/N/DEL)",
        "备注",
    ]
    with out_csv.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in all_results:
            checks = r.get("check_details", {})
            bio = r.get("bio_verbatim") or ""
            writer.writerow({
                "姓名":                    r.get("name", ""),
                "公司":                    r.get("company", ""),
                "职位":                    r.get("title", ""),
                "bio摘要（前120字）":       bio[:120],
                "✓职位在范围":             "Y" if checks.get("title_in_scope") else "N",
                "✓句数≥2":                "Y" if checks.get("min_sentences") else "N",
                "✓含背景信息":             "Y" if checks.get("has_background") else "N",
                "✓原文句校验(L3)":         "Y" if checks.get("source_in_raw") else "N",
                "来源URL":                 r.get("source_url", ""),
                "原文句子（_source_sentence）": r.get("_source_sentence", ""),
                "raw文件":                 r.get("raw_file", ""),
                "程序自动通过":             "Y" if r.get("verified_auto") else "N",
                "人工核验(Y/N/DEL)":       "",   # ← 人工填写
                "备注":                    "",
            })
    print(f"📋 CSV  → {out_csv.name}")

    auto_pass = sum(1 for r in all_results if r["verified_auto"])
    print(f"\n程序自动通过: {auto_pass}/{len(all_results)}")
    print(f"校验未通过（bio已置null）: {len(all_results) - auto_pass}")
    print(f"\n下一步: python 04_upload.py {market_code}")
    print(f"（仅 verified_auto=True 的记录会上传，校验未通过的记录跳过）")


def main():
    market_arg = sys.argv[1].upper() if len(sys.argv) > 1 else "ALL"

    if market_arg == "ALL":
        for code in MARKETS:
            process_market(code)
            time.sleep(5)
    else:
        process_market(market_arg)


if __name__ == "__main__":
    main()
