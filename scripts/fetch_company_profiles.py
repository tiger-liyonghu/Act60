#!/usr/bin/env python3
"""
fetch_company_profiles.py

用 Jina Reader (r.jina.ai) 抓取各保险公司官网，
用 DeepSeek LLM 提取公司简介，输出 public/data/companies.json。

使用：
    export DEEPSEEK_API_KEY=sk-xxxx
    python3 scripts/fetch_company_profiles.py
"""

import json, os, sys, time, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from openai import OpenAI

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
SOURCE_FILE = os.path.join(SCRIPT_DIR, "..", "..", "Actuary60", "00_全部数据.json")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "..", "public", "data", "companies.json")
REGION_MAP  = {"中国大陆": "CN", "中国香港": "HK", "新加坡": "SG"}

MAX_WORKERS     = 3      # 并发数（Jina 有速率限制，不宜过高）
SAVE_EVERY      = 10
JINA_TIMEOUT    = 20     # 秒
MAX_TEXT_LEN    = 4000   # 传给 LLM 的最大字符数

# 常见"关于我们"子路径，按优先级
ABOUT_PATHS = [
    "/gsjj/", "/gsjj", "/gsjj.html",
    "/about/", "/about", "/aboutus/", "/aboutus",
    "/intro/", "/introduce/",
    "/gsjs/", "/jjjj/",
    "/gyrb/jjjj/",
    "/cn/about/", "/zh/about/",
    "/who-we-are/",
    "/company/",
    "",          # 主页 fallback
]

JINA_HEADERS = {
    "Accept": "text/plain",
    "X-With-Images-Summary": "false",
    "X-Remove-Selector": "nav, footer, header, aside, .menu, .navigation",
}


def jina_fetch(url: str) -> str:
    """通过 Jina Reader 抓取 URL，返回 Markdown 纯文本"""
    jina_url = f"https://r.jina.ai/{url}"
    try:
        resp = requests.get(jina_url, headers=JINA_HEADERS, timeout=JINA_TIMEOUT)
        if resp.status_code == 200:
            return resp.text[:MAX_TEXT_LEN]
    except Exception:
        pass
    return ""


def llm_extract_intro(client: OpenAI, company_name: str, text: str) -> str:
    """DeepSeek 从网页文本中提取公司简介（≤300字）"""
    if not text or len(text) < 50:
        return ""
    prompt = f"""从以下网页内容中，为"{company_name}"提取公司简介。

网页内容：
{text}

要求：
- 提取公司基本介绍（成立时间、主营业务、规模、资质等）
- 不超过300字，语言简洁中立
- 去除导航、广告、联系方式、法律声明等无关内容
- 如果页面内容与该公司无关或找不到简介，返回空字符串

返回 JSON：{{"intro": "公司简介或空字符串"}}"""

    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是企业信息提取专家，只返回 JSON，不要其他文字。"},
                {"role": "user",   "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=600,
        )
        result = json.loads(resp.choices[0].message.content)
        return (result.get("intro") or "").strip()
    except Exception:
        return ""


def process_company(client: OpenAI, company: dict, idx: int, total: int) -> dict:
    name    = company["name"]
    website = company.get("website", "").rstrip("/")
    region  = company["region"]

    label = f"[{idx}/{total}] {name[:22]}"

    if not website or not website.startswith("http"):
        print(f"  {label}  — 无官网")
        return {"name": name, "region": region, "website": "",
                "intro": "", "fetched_url": ""}

    # 逐一尝试 about 路径
    for path in ABOUT_PATHS:
        url = website + path
        text = jina_fetch(url)
        if len(text) < 80:
            continue
        intro = llm_extract_intro(client, name, text)
        if intro and len(intro) > 20:
            print(f"  {label}  ✓ {len(intro)}字  ({path or '/'})")
            return {"name": name, "region": region, "website": website,
                    "intro": intro, "fetched_url": url}
        time.sleep(0.5)

    print(f"  {label}  ✗ 未获取简介")
    return {"name": name, "region": region, "website": website,
            "intro": "", "fetched_url": ""}


def main():
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("错误：请设置 DEEPSEEK_API_KEY 环境变量")
        sys.exit(1)

    def make_client():
        return OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    with open(SOURCE_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    print(f"加载: {len(raw)} 家公司")

    # 断点续跑
    existing: dict[str, dict] = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            for item in json.load(f):
                existing[item["name"]] = item
        print(f"已有记录: {len(existing)} 家（将跳过）")

    pending = [
        {"name": c["name"], "website": c.get("website", ""),
         "region": REGION_MAP.get(c.get("region", "中国大陆"), "CN")}
        for c in raw if c["name"] not in existing
    ]
    print(f"待处理: {len(pending)} 家\n")

    if not pending:
        print("全部已完成！")
        _write(existing)
        return

    lock = threading.Lock()
    results = dict(existing)
    save_counter = 0

    total = len(pending)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(process_company, make_client(), co, i + 1, total): co
            for i, co in enumerate(pending)
        }
        for future in as_completed(futures):
            item = future.result()
            with lock:
                results[item["name"]] = item
                save_counter += 1
                if save_counter % SAVE_EVERY == 0:
                    _write(results)
                    has = sum(1 for v in results.values() if v.get("intro"))
                    print(f"\n  ── 进度保存，有简介: {has}/{len(results)} ──\n")

    _write(results)
    has_intro = sum(1 for v in results.values() if v.get("intro"))
    print(f"\n完成！共 {len(results)} 家，获取到简介 {has_intro} 家")
    print(f"输出: {OUTPUT_FILE}")


def _write(results: dict):
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    data = sorted(results.values(), key=lambda x: x["name"])
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
