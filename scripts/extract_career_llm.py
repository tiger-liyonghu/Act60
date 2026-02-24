#!/usr/bin/env python3
"""
extract_career_llm.py

使用 DeepSeek API 从高管简介中提取结构化职业轨迹，
输出 career_path_overrides.json，供 mine_relationships.py 应用。

使用方法：
    export DEEPSEEK_API_KEY=sk-xxxx
    python3 scripts/extract_career_llm.py

支持断点续跑：已处理的高管自动跳过。
并发处理（5 线程），速度约 2-3 分钟/百人。

输出格式（career_path_overrides.json）：
{
  "姓名|公司名": [
    {"company": "...", "title": "...", "start_year": 2020, "end_year": null, "is_current": true},
    ...
  ],
  ...
}
"""

import json
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# ── 路径配置 ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_FILE = os.path.join(
    SCRIPT_DIR, "..", "..", "Actuary60", "00_全部数据.json"
)
OVERRIDES_FILE = os.path.join(SCRIPT_DIR, "career_path_overrides.json")

# ── 参数 ─────────────────────────────────────────────────
MODEL        = "deepseek-chat"   # DeepSeek-V3
MAX_WORKERS  = 5                 # 并发线程数
SAVE_EVERY   = 30                # 每完成 N 人保存一次
MAX_BIO_LEN  = 1500              # bio 截断长度

# ── System Prompt ─────────────────────────────────────────
SYSTEM_PROMPT = (
    "你是一名专业的保险行业数据提取专家。"
    "你的任务是从高管简介文本中，提取结构化的职业轨迹数据，严格按 JSON 格式返回。"
    "不要添加任何解释、注释或 markdown 代码块，只返回纯 JSON 数组。"
)


def build_prompt(name: str, company: str, title: str, bio: str) -> str:
    bio_snippet = bio[:MAX_BIO_LEN]
    return f"""请从以下高管简介中，提取完整的职业轨迹，返回 JSON 数组。

姓名：{name}
当前雇主：{company}
当前职位：{title}

简介原文：
{bio_snippet}

---

返回格式（JSON 数组，每条代表一段职位经历）：
[
  {{
    "company": "公司全称",
    "title": "职位名称",
    "start_year": 2020,
    "end_year": null,
    "is_current": true
  }}
]

严格规则：
1. 第一条必须是当前职位：company="{company}"，title="{title}"，is_current=true
2. 历史职位按时间倒序排列（最近 → 最早）
3. start_year / end_year：能从简介中明确读到则填整数，否则填 null
4. 现职的 end_year 必须为 null
5. 公司名使用简介中的原文全称，不要缩写
6. 只提取简介中有明确文字记载的职位，不要推测或补全
7. 兼任职位也要包含（is_current=true）
8. 只返回 JSON 数组，不要任何其他文字"""


def extract_career(client: OpenAI, name: str, company: str,
                   title: str, bio: str) -> list | None:
    prompt = build_prompt(name, company, title, bio)
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=1024,
        )
        raw_text = resp.choices[0].message.content.strip()
        parsed = json.loads(raw_text)

        if isinstance(parsed, list):
            return parsed
        for key in ("career", "career_path", "result", "data", "positions"):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        for v in parsed.values():
            if isinstance(v, list):
                return v
        return None

    except json.JSONDecodeError:
        return None
    except Exception:
        return None


def validate_steps(steps: list, company: str, title: str) -> list:
    if not steps:
        return [{"company": company, "title": title,
                 "start_year": None, "end_year": None, "is_current": True}]
    cleaned = []
    for step in steps:
        if not isinstance(step, dict):
            continue
        comp = (step.get("company") or "").strip()
        ttl  = (step.get("title")   or "").strip()
        if not comp and not ttl:
            continue
        cleaned.append({
            "company":    comp or company,
            "title":      ttl  or title,
            "start_year": step.get("start_year"),
            "end_year":   step.get("end_year"),
            "is_current": bool(step.get("is_current", False)),
        })
    if cleaned and not cleaned[0].get("is_current"):
        cleaned.insert(0, {
            "company": company, "title": title,
            "start_year": None, "end_year": None, "is_current": True
        })
    return cleaned


def process_one(client: OpenAI, exec_info: dict, idx: int, total: int) -> tuple[str, list | None]:
    """处理单个高管，返回 (key, steps_or_None)"""
    key    = f"{exec_info['name']}|{exec_info['company']}"
    result = extract_career(
        client,
        exec_info["name"], exec_info["company"],
        exec_info["title"], exec_info["bio"],
    )
    validated = validate_steps(result, exec_info["company"], exec_info["title"]) if result is not None else None
    label = f"[{idx}/{total}] {exec_info['name']} @ {exec_info['company'][:16]}"
    if validated:
        print(f"  {label}  ✓ {len(validated)} 步")
    else:
        print(f"  {label}  ✗")
    return key, validated


def main():
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("错误：请设置 DEEPSEEK_API_KEY 环境变量")
        print("  export DEEPSEEK_API_KEY=sk-xxxx")
        sys.exit(1)

    # 每个线程使用独立 client（OpenAI client 是线程安全的，但建议独立实例）
    def make_client():
        return OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    # ── 加载源数据 ────────────────────────────────────────
    with open(SOURCE_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    print(f"加载源数据: {len(raw)} 家公司")

    # ── 加载已有覆盖（断点续跑）───────────────────────────
    if os.path.exists(OVERRIDES_FILE):
        with open(OVERRIDES_FILE, encoding="utf-8") as f:
            overrides: dict = json.load(f)
        print(f"已有覆盖记录: {len(overrides)} 人（将跳过）")
    else:
        overrides = {}

    # ── 收集待处理高管 ────────────────────────────────────
    all_execs = []
    for company in raw:
        for e in company.get("executives", []):
            bio  = (e.get("bio") or "").strip()
            name = (e.get("name") or "").strip()
            if not name or not bio:
                continue
            key = f"{name}|{company['name']}"
            if key in overrides:
                continue  # 已处理，跳过
            all_execs.append({
                "name":    name,
                "company": company["name"],
                "title":   (e.get("title") or "").strip(),
                "bio":     bio,
            })

    skipped = len(overrides)
    total_all = skipped + len(all_execs)
    print(f"有简介高管: {total_all} 人  待处理: {len(all_execs)} 人  跳过: {skipped} 人\n")

    if not all_execs:
        print("全部已处理完毕！")
        return

    # ── 并发处理 ──────────────────────────────────────────
    lock = threading.Lock()
    processed = failed = 0
    save_counter = 0

    def save():
        with open(OVERRIDES_FILE, "w", encoding="utf-8") as f:
            json.dump(overrides, f, ensure_ascii=False, indent=2)

    total = len(all_execs)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(process_one, make_client(), exec_info, i + 1, total): exec_info
            for i, exec_info in enumerate(all_execs)
        }
        for future in as_completed(futures):
            key, validated = future.result()
            with lock:
                if validated is not None:
                    overrides[key] = validated
                    processed += 1
                else:
                    failed += 1
                save_counter += 1
                if save_counter % SAVE_EVERY == 0:
                    save()
                    print(f"\n  >> 已保存 ({processed} 成功 / {failed} 失败 / 共 {processed+failed}/{total})\n")

    save()
    print(f"\n{'='*50}")
    print(f"完成！新处理: {processed} 人  失败: {failed} 人  跳过(已有): {skipped} 人")
    print(f"总覆盖记录: {len(overrides)} 人")
    print(f"结果写入: {OVERRIDES_FILE}")


if __name__ == "__main__":
    main()
