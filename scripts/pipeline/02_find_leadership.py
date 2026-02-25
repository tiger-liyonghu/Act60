#!/usr/bin/env python3
"""
02_find_leadership.py — 为每家保险公司找到「高管/领导层」页面 URL

用法:
  python 02_find_leadership.py HK
  python 02_find_leadership.py SG
  python 02_find_leadership.py ALL

策略（按优先级，均使用现成工具，不调用 LLM）:
  1. sitemap.xml   → 用 Jina 抓取 sitemap，过滤含 leadership/management/team 的 URL
  2. 路径探测      → 对常见路径列表发 HEAD 请求，返回 200 即确认存在
  3. 人工补录      → 上述均失败，在输出文件中标记 "manual_needed": true

输入: data/companies_{MARKET}.json
输出: data/leadership_urls_{MARKET}.json
"""

import sys
import json
import time
import requests
from urllib.parse import urlparse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import (
    JINA_BASE_URL, JINA_API_KEY,
    DATA_DIR, RAW_DIR,
    MARKETS,
    LEADERSHIP_NAV_KEYWORDS, LEADERSHIP_URL_PATTERNS,
)

TODAY = datetime.now(timezone.utc).strftime("%Y%m%d")

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 (compatible; InsuranceDataBot/1.0)"})


# ===================== Jina 抓取 =====================

def jina_fetch(url: str, timeout: int = 60) -> tuple[str, bool]:
    """返回 (text, success)。失败时返回 (错误信息, False)。"""
    try:
        jina_url = JINA_BASE_URL + url
        headers = {"Accept": "text/plain"}
        if JINA_API_KEY:
            headers["Authorization"] = f"Bearer {JINA_API_KEY}"
        resp = SESSION.get(jina_url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp.text, True
    except Exception as e:
        return str(e), False


# ===================== 策略 1: sitemap.xml =====================

SITEMAP_KEYWORDS = [
    "leadership", "management", "executive", "team", "board",
    "our-team", "our-leadership", "about-us",
]

def find_via_sitemap(base_url: str) -> str | None:
    """
    尝试抓取 sitemap.xml，返回最匹配领导层的 URL。
    使用 Jina Reader，无需自己解析 XML。
    """
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    sitemap_url = f"{origin}/sitemap.xml"

    text, ok = jina_fetch(sitemap_url, timeout=30)
    if not ok:
        return None

    # 逐行扫描，找含关键词的 URL
    candidates = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("http"):
            continue
        line_lower = line.lower()
        score = sum(1 for kw in SITEMAP_KEYWORDS if kw in line_lower)
        if score > 0:
            candidates.append((score, line))

    if not candidates:
        return None

    # 返回得分最高的 URL
    candidates.sort(key=lambda x: -x[0])
    return candidates[0][1]


# ===================== 策略 2: 常见路径探测 =====================

def find_via_path_probe(base_url: str) -> str | None:
    """
    对 LEADERSHIP_URL_PATTERNS 中的路径逐一发 HEAD 请求。
    返回第一个 HTTP 200 的 URL。
    """
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    for pattern in LEADERSHIP_URL_PATTERNS:
        test_url = origin + pattern
        try:
            resp = SESSION.head(test_url, timeout=8, allow_redirects=True)
            if resp.status_code == 200:
                return test_url
        except Exception:
            continue
        time.sleep(0.3)

    return None


# ===================== 主流程 =====================

def process_market(market_code: str):
    companies_file = DATA_DIR / f"companies_{market_code}.json"
    if not companies_file.exists():
        print(f"❌ 找不到 {companies_file}，请先运行 01_find_companies.py")
        return

    companies = json.loads(companies_file.read_text(encoding="utf-8"))
    print(f"\n{'='*60}")
    print(f"📍 市场: {market_code} — 共 {len(companies)} 家公司")
    print(f"{'='*60}")

    results = []

    for i, company in enumerate(companies, 1):
        name = company.get("company_name", "unknown")
        website = company.get("website")

        print(f"\n[{i}/{len(companies)}] {name}")

        if not website:
            print(f"  ⚠️  无官网地址，标记 manual_needed")
            results.append({
                **company,
                "leadership_url": None,
                "find_method": "no_website",
                "manual_needed": True,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            })
            continue

        leadership_url = None
        find_method = None

        # --- 策略 1: sitemap.xml ---
        print(f"  [策略1] sitemap.xml 扫描...")
        leadership_url = find_via_sitemap(website)
        if leadership_url:
            find_method = "sitemap"
            print(f"  ✅ sitemap 找到: {leadership_url}")

        # --- 策略 2: 路径探测 ---
        if not leadership_url:
            print(f"  [策略2] 路径探测（{len(LEADERSHIP_URL_PATTERNS)} 种模式）...")
            leadership_url = find_via_path_probe(website)
            if leadership_url:
                find_method = "path_probe"
                print(f"  ✅ 路径探测找到: {leadership_url}")

        # --- 均失败 ---
        if not leadership_url:
            print(f"  ❌ 自动查找失败，标记 manual_needed")
            find_method = "not_found"

        results.append({
            **company,
            "leadership_url": leadership_url,
            "find_method": find_method,
            "manual_needed": leadership_url is None,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        })

        time.sleep(1)

    # 保存结果
    out_file = DATA_DIR / f"leadership_urls_{market_code}.json"
    out_file.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    found = sum(1 for r in results if r["leadership_url"])
    manual = sum(1 for r in results if r.get("manual_needed"))

    print(f"\n{'='*60}")
    print(f"✅ 完成！{found}/{len(results)} 家找到领导层页面 → {out_file.name}")
    if manual:
        print(f"⚠️  {manual} 家需人工补录 leadership_url（在 JSON 中搜索 manual_needed: true）")

    # 打印需人工处理的清单
    if manual:
        print("\n需人工补录：")
        for r in results:
            if r.get("manual_needed"):
                print(f"  • {r['company_name']} | 官网: {r.get('website', '无')}")


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
