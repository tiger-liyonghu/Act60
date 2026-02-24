#!/usr/bin/env python3
"""
migrate_to_supabase.py

将 public/data/executives.json 和 relationships.json 上传到 Supabase。

使用：
    SUPABASE_URL=https://xxxx.supabase.co \
    SUPABASE_SERVICE_KEY=eyJ... \
    python3 scripts/migrate_to_supabase.py
"""

import json, os, sys, time
from supabase import create_client, Client

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
EXECS_FILE   = os.path.join(SCRIPT_DIR, "..", "public", "data", "executives.json")
RELS_FILE    = os.path.join(SCRIPT_DIR, "..", "public", "data", "relationships.json")
BATCH        = 200   # 每批行数

def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("错误：请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量")
        sys.exit(1)
    return create_client(url, key)


def upsert_batches(sb: Client, table: str, rows: list, pk: str = "id"):
    total = len(rows)
    for i in range(0, total, BATCH):
        batch = rows[i : i + BATCH]
        sb.table(table).upsert(batch, on_conflict=pk).execute()
        print(f"  {table}: {min(i+BATCH, total)}/{total}")
        time.sleep(0.2)


def main():
    sb = get_client()

    # ── Executives ────────────────────────────────────────
    print("加载 executives.json …")
    with open(EXECS_FILE, encoding="utf-8") as f:
        execs_raw = json.load(f)

    execs = []
    for e in execs_raw:
        execs.append({
            "id":             e["id"],
            "name":           e.get("name", ""),
            "title":          e.get("title", ""),
            "company":        e.get("company", ""),
            "region":         e.get("region", "CN"),
            "website":        e.get("website", ""),
            "bio":            e.get("bio", ""),
            "extracted":      e.get("extracted", {}),
            "career_path":    e.get("career_path", []),
            "person_identity": e.get("identity"),
            "education":      e.get("education", []),
            "qualifications": e.get("qualifications", []),
            "board_roles":    e.get("board_roles", []),
            "industry_roles": e.get("industry_roles", []),
        })

    print(f"上传 {len(execs)} 名高管 …")
    upsert_batches(sb, "executives", execs, pk="id")

    # ── Relationships ─────────────────────────────────────
    print("\n加载 relationships.json …")
    with open(RELS_FILE, encoding="utf-8") as f:
        rels_raw = json.load(f)

    # relationships.json 里 source/target 是 id 数字
    rels = []
    for r in rels_raw:
        src = r["source"] if isinstance(r["source"], int) else r["source"]["id"]
        tgt = r["target"] if isinstance(r["target"], int) else r["target"]["id"]
        rels.append({
            "source_id": src,
            "target_id": tgt,
            "type":      r.get("type", ""),
            "strength":  r.get("strength", 1.0),
            "label":     r.get("label", ""),
        })

    print(f"上传 {len(rels)} 条关系（先清空再插入）…")
    # relationships 用 SERIAL id，每次全量重写
    sb.table("relationships").delete().neq("id", 0).execute()
    for i in range(0, len(rels), BATCH):
        batch = rels[i : i + BATCH]
        sb.table("relationships").insert(batch).execute()
        print(f"  relationships: {min(i+BATCH, len(rels))}/{len(rels)}")
        time.sleep(0.2)

    print("\n✓ 迁移完成！")


if __name__ == "__main__":
    main()
