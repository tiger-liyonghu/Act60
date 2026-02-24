#!/usr/bin/env python3
"""
llm_extract_schools.py
使用 Claude API 从 bio 文本中提取准确院校名称，直接覆盖 executives.json 中的 extracted.schools。

用法：
  # 先跑样本验证（不写回）
  python3 llm_extract_schools.py --sample 20

  # 全量运行并写回
  python3 llm_extract_schools.py
"""

import json
import time
import os
import sys
import argparse
from openai import OpenAI

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXEC_FILE = os.path.join(SCRIPT_DIR, "..", "public", "data", "executives.json")

client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
    base_url="https://api.deepseek.com",
)

SYSTEM_PROMPT = """你是一个精准的信息提取助手。从给定的保险高管简介文本中，提取此人本人就读过的学校正式名称。

【提取规则】
1. 提取此人本人作为学生就读过的学校，包括本科、硕士、博士、博士后所在学校
2. 若简介提到"XX大学校友"、"XX大学校友会"、"XX大学校友总会"，无论该人同时担任何种职务，都说明此人曾就读该校，必须提取
3. 返回学校当前正式名称（如"华中工学院"→"华中科技大学"，"原中南财经大学"→"中南财经政法大学"，"原华东政法学院"→"华东政法大学"）

【不提取的情况】
- 学历描述词：如"拥有大学学历"、"具有大学本科"、"获得大学学位"等
- 此人在该校任职（教授、副教授、讲师、客座/特聘/兼职教授、副院长、院长等教学职务）
- 访问学者、进修班、培训班
- 仅担任董事、理事、顾问等治理职务（但若同时提及"校友"则必须提取）

【输出格式】
严格返回 JSON：{"schools": ["学校1", "学校2"]}，无则 {"schools": []}
只返回 JSON，不要任何解释文字"""


def extract_schools_from_bio(bio: str) -> list[str] | None:
    """调用 Claude API 提取院校列表，失败返回 None。"""
    try:
        msg = client.chat.completions.create(
            model="deepseek-chat",
            max_tokens=300,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"简介：{bio}"},
            ],
        )
        text = msg.choices[0].message.content.strip()
        result = json.loads(text)
        schools = result.get("schools", [])
        # 基本合法性过滤：去除空字符串、过短的
        return [s.strip() for s in schools if isinstance(s, str) and len(s.strip()) >= 3]
    except json.JSONDecodeError:
        print(f"    JSON 解析失败，原始输出: {msg.content[0].text[:100]}")
        return None
    except Exception as e:
        print(f"    API 错误: {e}")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", type=int, default=0,
                        help="只处理前N条（样本验证模式，不写回文件）")
    args = parser.parse_args()

    with open(EXEC_FILE, encoding="utf-8") as f:
        executives = json.load(f)

    sample_mode = args.sample > 0

    # 加载已有覆盖，跳过已处理的
    existing_overrides = {}
    if os.path.exists(SCHOOL_OVERRIDES_FILE := os.path.join(SCRIPT_DIR, "school_overrides.json")):
        with open(SCHOOL_OVERRIDES_FILE, encoding="utf-8") as f:
            existing_overrides = json.load(f)

    all_targets = [e for e in executives if e.get("bio") and len(e.get("bio", "")) >= 10]
    # 只处理尚未在 overrides 中的
    targets = [e for e in all_targets if str(e["id"]) not in existing_overrides]

    if sample_mode:
        targets = targets[:args.sample]
        print(f"=== 样本模式：处理前 {len(targets)} 条（不写回）===\n")
    else:
        print(f"共 {len(executives)} 人，有bio {len(all_targets)} 人，"
              f"已处理 {len(existing_overrides)} 人，待处理 {len(targets)} 人\n")

    updated = 0
    skipped_empty = len(executives) - len([e for e in executives if e.get("bio")])
    failed = 0

    for i, exec_obj in enumerate(targets):
        name = exec_obj.get("name", "?")
        bio = exec_obj.get("bio", "")
        old_schools = exec_obj.get("extracted", {}).get("schools", [])

        if i % 100 == 0 and not sample_mode:
            print(f"进度: {i}/{len(targets)}  更新:{updated}  失败:{failed}")

        new_schools = extract_schools_from_bio(bio)

        if new_schools is None:
            failed += 1
            print(f"  [{i}] {name} — 失败，保留原值")
            time.sleep(2)
            continue

        if sample_mode:
            # 样本模式：打印对比
            changed = set(old_schools) != set(new_schools)
            marker = "★" if changed else " "
            print(f"{marker} [{i:3d}] {name}")
            if changed:
                print(f"      旧: {old_schools}")
                print(f"      新: {new_schools}")
            else:
                print(f"      = {new_schools}")
        else:
            exec_obj["extracted"]["schools"] = new_schools

        updated += 1
        time.sleep(0.35)  # ~2.8 req/s，安全范围内

    if not sample_mode:
        # 合并新旧覆盖映射（供 mine_relationships.py 复用）
        overrides = dict(existing_overrides)  # 保留旧结果
        for e in executives:
            if e.get("bio") and len(e.get("bio", "")) >= 10:
                overrides[str(e["id"])] = e["extracted"]["schools"]
        overrides_file = os.path.join(SCRIPT_DIR, "school_overrides.json")
        with open(overrides_file, "w", encoding="utf-8") as f:
            json.dump(overrides, f, ensure_ascii=False, indent=2)
        print(f"已保存覆盖映射: {overrides_file} ({len(overrides)} 条)")

        # 写回 executives.json
        with open(EXEC_FILE, "w", encoding="utf-8") as f:
            json.dump(executives, f, ensure_ascii=False, indent=2)
        print(f"\n完成！更新:{updated}  跳过(无bio):{skipped_empty}  失败:{failed}")
        print(f"已写回: {EXEC_FILE}")
    else:
        print(f"\n样本统计：处理 {len(targets)} 条，API成功 {updated} 条，失败 {failed} 条")
        print("确认质量后运行：python3 llm_extract_schools.py")


if __name__ == "__main__":
    main()
