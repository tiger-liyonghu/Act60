#!/usr/bin/env python3
"""
01_find_companies.py — 从监管机构官网获取所有持牌保险公司名单

用法:
  python 01_find_companies.py HK
  python 01_find_companies.py SG
  python 01_find_companies.py ALL

流程:
  监管机构官网（IA / MAS）
    → Jina Reader 抓取
    → 保存原始文本到 raw/{MARKET}_regulator_{date}.txt
    → LLM 提取公司名 + 官网地址（仅提取原文中出现的内容）
    → 输出 data/companies_{MARKET}.json

输出字段:
  company_name      英文全名（原文）
  company_name_zh   中文名（原文中有则填，否则 null）
  website           官网 URL（原文中明确标注则填，否则 null）
  license_type      许可证类型（原文）
  _source           原文中对应行（用于核验）
  market            市场代码
  regulator_source_url  来源 URL
  scraped_at        抓取时间
  raw_file          原始文本文件名
"""

import sys
import json
import time
import requests
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import MARKETS, JINA_BASE_URL, JINA_API_KEY, LLM_API_URL, LLM_API_KEY, LLM_MODEL, DATA_DIR, RAW_DIR

TODAY = datetime.now(timezone.utc).strftime("%Y%m%d")


# ===================== 工具函数 =====================

def jina_fetch(url: str) -> str:
    """使用 Jina Reader 抓取页面，返回 markdown 文本。"""
    jina_url = JINA_BASE_URL + url
    headers = {"Accept": "text/plain"}
    if JINA_API_KEY:
        headers["Authorization"] = f"Bearer {JINA_API_KEY}"
    print(f"  [Jina] 抓取: {url}")
    resp = requests.get(jina_url, headers=headers, timeout=90)
    resp.raise_for_status()
    return resp.text


def llm_call(prompt: str) -> str:
    """调用 LLM（DeepSeek / OpenAI 兼容），temperature=0 消除随机性。"""
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
            "temperature": 0,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def clean_json_response(text: str) -> str:
    """去除 LLM 输出中的 markdown 代码块标记。"""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()


# ===================== LLM Prompt =====================

EXTRACT_COMPANIES_PROMPT = """你是数据提取助手。请从以下监管机构页面原文中，提取所有持牌保险公司的信息。

【严格规则】
1. 只提取页面中明确出现的文字，不推断、不补充
2. company_name 使用页面原文（英文优先）
3. website 只填写页面中明确标注的官网地址，找不到返回 null
4. license_type 填写页面中出现的许可证类型原文，找不到返回 null
5. _source 填写原文中提取该公司的对应行，用于事后核验
6. 不要添加任何未在原文出现的公司

市场: {market}
监管机构: {regulator}
来源 URL: {source_url}

页面原文:
{raw_text}

请返回 JSON 数组：
[
  {{
    "company_name": "公司英文全名（原文）",
    "company_name_zh": "公司中文名（原文中有则填，否则 null）",
    "website": "官网 URL（原文中有则填，否则 null）",
    "license_type": "许可证类型（如 Long Term Insurer / General Insurer，原文）",
    "_source": "原文中提取该公司的对应行（完整原句）"
  }}
]

只返回 JSON 数组，不要其他文字。找不到任何公司则返回 []。"""


# ===================== 主流程 =====================

def process_market(market_code: str):
    config = MARKETS.get(market_code)
    if not config:
        print(f"❌ 未知市场: {market_code}，可用: {list(MARKETS.keys())}")
        return

    print(f"\n{'='*60}")
    print(f"📍 市场: {config['name']} ({market_code})")
    print(f"📋 监管机构: {config['regulator_name']}")
    print(f"🔗 来源: {config['regulator_url']}")
    print(f"{'='*60}")

    # Step 1: Jina 抓取监管机构注册名单页面
    try:
        raw_text = jina_fetch(config["regulator_url"])
    except Exception as e:
        print(f"❌ 抓取失败: {e}")
        return

    # Step 2: 保存原始文本 (L1 留档)
    raw_file = RAW_DIR / f"{market_code}_regulator_{TODAY}.txt"
    raw_file.write_text(raw_text, encoding="utf-8")
    print(f"  [L1] 原始文本已保存 → {raw_file.name} ({len(raw_text):,} 字符)")

    # Step 3: LLM 提取公司列表
    # 如果页面过长，分段处理（每段 12000 字符）
    chunk_size = 12000
    all_companies = []
    chunks = [raw_text[i:i+chunk_size] for i in range(0, len(raw_text), chunk_size)]

    print(f"  [LLM] 分 {len(chunks)} 段提取公司列表...")
    for idx, chunk in enumerate(chunks, 1):
        prompt = EXTRACT_COMPANIES_PROMPT.format(
            market=market_code,
            regulator=config["regulator_name"],
            source_url=config["regulator_url"],
            raw_text=chunk,
        )
        llm_response = ""
        try:
            llm_response = llm_call(prompt)
            cleaned = clean_json_response(llm_response)
            companies_chunk = json.loads(cleaned)
            all_companies.extend(companies_chunk)
            print(f"    段 {idx}/{len(chunks)}: 提取 {len(companies_chunk)} 家")
        except Exception as e:
            print(f"    段 {idx} 解析失败: {e}")
            if llm_response:
                print(f"    LLM 原始输出: {llm_response[:300]}")
        time.sleep(1)

    # Step 4: 去重（按 company_name）
    seen = set()
    unique = []
    for c in all_companies:
        key = c.get("company_name", "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(c)
    all_companies = unique

    # Step 5: 添加元数据
    scraped_at = datetime.now(timezone.utc).isoformat()
    for c in all_companies:
        c["market"] = market_code
        c["regulator_source_url"] = config["regulator_url"]
        c["scraped_at"] = scraped_at
        c["raw_file"] = raw_file.name

    # Step 6: 保存结果
    out_file = DATA_DIR / f"companies_{market_code}.json"
    out_file.write_text(json.dumps(all_companies, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n✅ 完成！共找到 {len(all_companies)} 家持牌保险公司 → {out_file.name}")
    print("\n前 10 家预览：")
    for c in all_companies[:10]:
        website_str = c.get("website") or "（官网未在原文列出）"
        print(f"  • {c['company_name']} | {website_str}")
    if len(all_companies) > 10:
        print(f"  ... 共 {len(all_companies)} 家")


def main():
    market_arg = sys.argv[1].upper() if len(sys.argv) > 1 else "ALL"

    if market_arg == "ALL":
        for code in MARKETS:
            process_market(code)
            time.sleep(3)
    else:
        process_market(market_arg)


if __name__ == "__main__":
    main()
