#!/usr/bin/env python3
"""
discover_bio_fields.py — 阶段一：无结构探索发现

从各地区抽取代表性 bio，让 LLM 自由提取所有可结构化字段，
不预设任何 schema，输出到 bio_discovery_report.json 供人工归纳。

使用：
    export DEEPSEEK_API_KEY=sk-xxxx
    python3 scripts/discover_bio_fields.py
"""

import json, os, sys, random, time
from collections import defaultdict
from openai import OpenAI

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
SOURCE_FILE = os.path.join(SCRIPT_DIR, "..", "..", "Actuary60", "00_全部数据.json")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "bio_discovery_report.json")

REGION_MAP = {"中国大陆": "CN", "中国香港": "HK", "新加坡": "SG"}

# 抽样策略：CN按bio长度分短/中/长；HK/SG全取或最多15条
SAMPLE_PLAN = {
    "CN_short":  8,   # bio < 100字
    "CN_medium": 10,  # bio 100-300字
    "CN_long":   10,  # bio > 300字
    "HK":        8,
    "SG":        10,
}

SYSTEM_PROMPT = """你是一名保险行业数据分析专家。
你的任务是从高管简介中，提取所有可以结构化存储的信息。
不要使用任何预定义的字段名称，完全基于简介内容自由提取。
以 JSON 对象格式返回，字段名用英文，值用原文语言。"""

USER_PROMPT_TEMPLATE = """请从以下高管简介中，提取所有可以结构化存储的信息。

重要要求：
- 不要预设字段，有什么提什么
- 字段名用英文（如 birth_year, education, former_roles 等）
- 值保留原文，不要翻译
- 信息不确定时不要填写，直接省略该字段
- 只返回 JSON 对象，不要解释

地区：{region}
姓名：{name}
当前公司：{company}
当前职位：{title}

简介原文：
{bio}"""


def sample_bios(raw: list) -> list:
    """按计划抽取代表性 bio 样本"""
    pools = defaultdict(list)
    for company in raw:
        region = REGION_MAP.get(company.get('region', '中国大陆'), 'CN')
        for e in company.get('executives', []):
            bio = (e.get('bio') or '').strip()
            name = (e.get('name') or '').strip()
            if not bio or not name or len(bio) < 20:
                continue
            entry = {
                'name': name,
                'company': company['name'],
                'title': (e.get('title') or '').strip(),
                'region': region,
                'bio': bio,
            }
            bio_len = len(bio)
            if region == 'CN':
                if bio_len < 100:
                    pools['CN_short'].append(entry)
                elif bio_len <= 300:
                    pools['CN_medium'].append(entry)
                else:
                    pools['CN_long'].append(entry)
            else:
                pools[region].append(entry)

    random.seed(42)  # 可复现
    samples = []
    for group, count in SAMPLE_PLAN.items():
        pool = pools.get(group, [])
        picked = random.sample(pool, min(count, len(pool)))
        for p in picked:
            p['_group'] = group
        samples.extend(picked)

    print(f"\n抽样结果：")
    for group in SAMPLE_PLAN:
        n = sum(1 for s in samples if s['_group'] == group)
        print(f"  {group}: {n} 人")
    print(f"  合计: {len(samples)} 人\n")
    return samples


def extract_fields(client: OpenAI, entry: dict) -> dict | None:
    prompt = USER_PROMPT_TEMPLATE.format(
        region=entry['region'],
        name=entry['name'],
        company=entry['company'],
        title=entry['title'],
        bio=entry['bio'],
    )
    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=1024,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        print(f"    ✗ {e}")
        return None


def main():
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("错误：请设置 DEEPSEEK_API_KEY 环境变量")
        sys.exit(1)

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    with open(SOURCE_FILE, encoding='utf-8') as f:
        raw = json.load(f)
    print(f"加载源数据: {len(raw)} 家公司")

    samples = sample_bios(raw)

    results = []
    all_keys = defaultdict(int)   # 字段名 → 出现次数

    for i, entry in enumerate(samples):
        print(f"[{i+1}/{len(samples)}] {entry['name']} @ {entry['company'][:20]} ({entry['region']})", end="  ", flush=True)
        fields = extract_fields(client, entry)
        if fields:
            print(f"✓  提取到 {len(fields)} 个字段: {list(fields.keys())}")
            for k in fields:
                all_keys[k] += 1
            results.append({
                "name":    entry['name'],
                "company": entry['company'],
                "region":  entry['region'],
                "group":   entry['_group'],
                "bio":     entry['bio'],
                "extracted": fields,
            })
        else:
            print("✗")
        time.sleep(0.3)

    # ── 汇总报告 ──────────────────────────────────────────
    report = {
        "_summary": {
            "total_sampled": len(samples),
            "total_extracted": len(results),
            "field_frequency": dict(sorted(all_keys.items(), key=lambda x: -x[1])),
        },
        "samples": results,
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"探索完成！共 {len(results)} 条结果")
    print(f"\n字段出现频率（从高到低）：")
    for field, count in sorted(all_keys.items(), key=lambda x: -x[1]):
        pct = count / len(results) * 100
        bar = '█' * int(pct / 5)
        print(f"  {field:<30} {count:>3}/{len(results)}  {pct:4.0f}%  {bar}")
    print(f"\n详细结果: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
