#!/usr/bin/env python3
"""
04_upload.py — 将自动校验通过的高管数据上传至 Supabase

用法:
  python 04_upload.py HK
  python 04_upload.py SG
  python 04_upload.py ALL

上传规则:
  - 只上传 verified_auto=True 的记录（通过全部三层程序校验）
  - 校验未通过的记录（bio=null 等）跳过，不写入数据库
  - bio_raw 只在 bio_verbatim 非空时写入（逐字原文，有来源保障）

前置条件:
  - 已运行 03_scrape_bios.py，存在 data/scraped_{MARKET}.json
  - 环境变量 SUPABASE_SERVICE_KEY 已设置（Service Role Key）
  - 已在 Supabase 执行 ../add_source_fields.sql

上传字段:
  name, name_zh, title, company_id, market_id
  source_url, scraped_at, verified=True, bio_raw（如有）
"""

import sys
import json
import time
import requests
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR, SUPABASE_URL, SUPABASE_SERVICE_KEY, MARKETS


# ===================== Supabase 工具 =====================

def sb_headers() -> dict:
    return {
        "apikey"       : SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type" : "application/json",
        "Prefer"       : "return=representation",
    }


def sb_upsert(table: str, data: list, on_conflict: str) -> list:
    url  = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    resp = requests.post(url, headers=sb_headers(), json=data, timeout=30)
    if not resp.ok:
        raise RuntimeError(f"upsert {table} 失败: {resp.status_code}\n{resp.text[:400]}")
    return resp.json()


def sb_select(table: str, filters: dict) -> list:
    params = "&".join(f"{k}=eq.{quote(str(v))}" for k, v in filters.items())
    url    = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    resp   = requests.get(url, headers=sb_headers(), timeout=15)
    resp.raise_for_status()
    return resp.json()


def get_market_id(market_code: str) -> int:
    rows = sb_select("markets", {"code": market_code})
    if rows:
        return rows[0]["id"]
    result = sb_upsert("markets", [{"code": market_code}], "code")
    return result[0]["id"]


def get_or_create_company(name: str, market_id: int, website: Optional[str]) -> int:
    rows = sb_select("companies", {"name": name, "market_id": market_id})
    if rows:
        return rows[0]["id"]
    result = sb_upsert(
        "companies",
        [{"name": name, "market_id": market_id, "website": website}],
        "name,market_id",
    )
    return result[0]["id"]


# ===================== 主流程 =====================

def process_market(market_code: str):
    scraped_file = DATA_DIR / f"scraped_{market_code}.json"
    if not scraped_file.exists():
        print(f"❌ 找不到 {scraped_file}，请先运行 03_scrape_bios.py")
        return

    if not SUPABASE_SERVICE_KEY:
        print("❌ 请设置环境变量 SUPABASE_SERVICE_KEY")
        return

    all_records = json.loads(scraped_file.read_text(encoding="utf-8"))

    # 只上传程序校验通过的记录
    to_upload = [r for r in all_records if r.get("verified_auto")]
    skipped   = len(all_records) - len(to_upload)

    print(f"\n{'='*60}")
    print(f"📍 上传市场: {market_code}")
    print(f"   总记录: {len(all_records)}")
    print(f"   上传（verified_auto=True）: {len(to_upload)}")
    print(f"   跳过（校验未通过）: {skipped}")
    print(f"{'='*60}")

    if not to_upload:
        print("⚠️  没有通过校验的记录，请检查 03_scrape_bios.py 的输出。")
        return

    market_id = get_market_id(market_code)
    print(f"  market_id = {market_id}\n")

    success = 0
    failed  = 0

    for r in to_upload:
        company_name = r.get("company", "")
        name         = r.get("name", "")
        try:
            company_id = get_or_create_company(
                name      = company_name,
                market_id = market_id,
                website   = r.get("website"),
            )

            # external_id = {MARKET}_{公司缩写}_{姓名}，防止同名不同公司碰撞
            co_slug   = re.sub(r'[^A-Za-z0-9]', '', company_name)[:15]
            name_slug = re.sub(r'[^A-Za-z0-9]', '_', name)
            ext_id    = f"{market_code}_{co_slug}_{name_slug}"[:60]

            exec_record: dict = {
                "external_id": ext_id,
                "name"       : name,
                "name_zh"    : r.get("name_zh"),
                "title"      : r.get("title"),
                "company_id" : company_id,
                "market_id"  : market_id,
                "source_url" : r.get("source_url"),
                "scraped_at" : r.get("scraped_at"),
                "verified"   : True,
                "is_active"  : True,
            }

            # bio_raw: 只在通过 L3 校验（bio_verbatim 非 null）时写入
            if r.get("bio_verbatim"):
                exec_record["bio_raw"] = r["bio_verbatim"]

            sb_upsert("executives", [exec_record], "external_id")
            print(f"  ✅ {name} @ {company_name}")
            success += 1

        except Exception as e:
            print(f"  ❌ {name} @ {company_name}: {e}")
            failed += 1

        time.sleep(0.3)

    print(f"\n{'='*60}")
    print(f"✅ 上传完成: {success} 成功, {failed} 失败")


def main():
    market_arg = sys.argv[1].upper() if len(sys.argv) > 1 else "ALL"

    if market_arg == "ALL":
        for code in MARKETS:
            process_market(code)
            time.sleep(2)
    else:
        process_market(market_arg)


if __name__ == "__main__":
    main()
