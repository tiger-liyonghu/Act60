#!/usr/bin/env python3
"""
parse_bios_llm.py — 全量原子化简介解析

对所有高管简介进行 LLM 解析，输出 bio_atoms.json。
bio_atoms.json 是所有下游分析（关系挖掘、图谱、侧边栏）的唯一数据源。

使用：
    export DEEPSEEK_API_KEY=sk-xxxx
    python3 scripts/parse_bios_llm.py

支持断点续跑：已处理的高管自动跳过。
并发处理（5 线程）。
"""

import json, os, sys, time, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# ── 路径配置 ──────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
SOURCE_FILE = os.path.join(SCRIPT_DIR, "..", "..", "Actuary60", "00_全部数据.json")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "bio_atoms.json")

REGION_MAP = {"中国大陆": "CN", "中国香港": "HK", "新加坡": "SG"}

# ── 参数 ─────────────────────────────────────────────────
MODEL       = "deepseek-chat"
MAX_WORKERS = 5
SAVE_EVERY  = 30
MAX_BIO_LEN = 2000

# ── System Prompt ─────────────────────────────────────────
SYSTEM_PROMPT = """你是一名保险行业数据提取专家。
从高管简介中提取结构化数据，严格按照给定 JSON schema 返回。
规则：
- 简介中明确写明的信息才填写，不要推测或补全
- 缺失信息一律填 null 或空数组 []
- 只返回纯 JSON 对象，不要任何解释或 markdown"""

# ── 用户 Prompt 模板 ──────────────────────────────────────
USER_PROMPT = """从以下高管简介中提取信息，按给定 schema 返回 JSON。

地区：{region}
姓名：{name}
当前公司：{company}
当前职位：{title}

简介原文：
{bio}

---

返回以下 JSON 结构（所有字段必须存在，缺失填 null 或 []）：

{{
  "identity": {{
    "birth_year": null,
    "gender": null
  }},
  "education": [
    {{
      "school": "学校全名",
      "degree": "学士/硕士/博士/MBA/EMBA/其他",
      "major": "专业",
      "year": null
    }}
  ],
  "qualifications": [],
  "career": [
    {{
      "company": "公司全称",
      "title": "职位名称",
      "start_year": null,
      "end_year": null,
      "is_current": true
    }}
  ],
  "board_roles": [
    {{
      "company": "公司全称",
      "role": "职位",
      "is_current": true
    }}
  ],
  "industry_roles": [],
  "regulator_bg": [],
  "experience_years": null
}}

字段说明：
- identity.birth_year：出生年份（整数），简介未提及则 null
- identity.gender：简介明确提及则填 "M" 或 "F"，否则 null
- education：所有学历记录，degree 统一为：学士/硕士/博士/MBA/EMBA/其他
- qualifications：职称和专业资格列表，如["高级经济师","FIA","FCPA"]
- career：所有工作经历（含现职、历史职位、兼任子公司执行职位），按时间倒序，第一条是当前主职
- board_roles：在外部/非控股机构担任的纯董事职务（非执行董事/独立董事/外部董事等）
- industry_roles：行业协会、专委会、政府咨询等非商业职务，以字符串列表形式
- regulator_bg：曾任职的监管机构名称列表，如["中国银保监会","证监会"]
- experience_years：简介中明确提及的从业年数（整数），未提及则 null"""


def call_llm(client: OpenAI, entry: dict) -> dict | None:
    prompt = USER_PROMPT.format(
        region  = entry["region"],
        name    = entry["name"],
        company = entry["company"],
        title   = entry["title"],
        bio     = entry["bio"][:MAX_BIO_LEN],
    )
    try:
        resp = client.chat.completions.create(
            model    = MODEL,
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
            response_format = {"type": "json_object"},
            temperature     = 0.0,
            max_tokens      = 1500,
        )
        raw = resp.choices[0].message.content.strip()
        parsed = json.loads(raw)

        # 有些模型会包一层，尝试拆包
        if not any(k in parsed for k in ("identity","education","career")):
            for v in parsed.values():
                if isinstance(v, dict) and "career" in v:
                    return v
        return parsed
    except Exception:
        return None


def normalize(result: dict, company: str, title: str) -> dict:
    """确保所有字段存在且类型正确"""
    def _get(key, default):
        v = result.get(key)
        return v if v is not None else default

    identity = _get("identity", {})
    if not isinstance(identity, dict):
        identity = {}

    education = _get("education", [])
    if not isinstance(education, list):
        education = []

    qualifications = _get("qualifications", [])
    if not isinstance(qualifications, list):
        qualifications = []

    career = _get("career", [])
    if not isinstance(career, list) or not career:
        career = [{"company": company, "title": title,
                   "start_year": None, "end_year": None, "is_current": True}]
    else:
        # 确保第一条是 is_current=True
        if not career[0].get("is_current"):
            career.insert(0, {"company": company, "title": title,
                               "start_year": None, "end_year": None, "is_current": True})

    board_roles = _get("board_roles", [])
    if not isinstance(board_roles, list):
        board_roles = []

    industry_roles = _get("industry_roles", [])
    if not isinstance(industry_roles, list):
        industry_roles = []
    industry_roles = [r for r in industry_roles if isinstance(r, str) and r.strip()]

    regulator_bg = _get("regulator_bg", [])
    if not isinstance(regulator_bg, list):
        regulator_bg = []
    regulator_bg = [r for r in regulator_bg if isinstance(r, str) and r.strip()]

    exp_years = result.get("experience_years")
    if not isinstance(exp_years, int):
        exp_years = None

    return {
        "identity":        {"birth_year": identity.get("birth_year"),
                            "gender":     identity.get("gender")},
        "education":       education,
        "qualifications":  qualifications,
        "career":          career,
        "board_roles":     board_roles,
        "industry_roles":  industry_roles,
        "regulator_bg":    regulator_bg,
        "experience_years": exp_years,
    }


def process_one(client: OpenAI, entry: dict, idx: int, total: int) -> tuple[str, dict | None]:
    key    = f"{entry['name']}|{entry['company']}"
    result = call_llm(client, entry)
    if result is not None:
        atom = normalize(result, entry["company"], entry["title"])
        n_career = len(atom["career"])
        n_edu    = len(atom["education"])
        print(f"  [{idx}/{total}] {entry['name']:<8} @ {entry['company'][:16]}  "
              f"career={n_career} edu={n_edu} qual={len(atom['qualifications'])}")
        return key, atom
    else:
        print(f"  [{idx}/{total}] {entry['name']:<8} @ {entry['company'][:16]}  ✗")
        return key, None


def main():
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("错误：请设置 DEEPSEEK_API_KEY 环境变量")
        sys.exit(1)

    def make_client():
        return OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    # ── 加载源数据 ────────────────────────────────────────
    with open(SOURCE_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    print(f"加载源数据: {len(raw)} 家公司")

    # ── 加载已有结果（断点续跑）──────────────────────────
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            atoms: dict = json.load(f)
        print(f"已有记录: {len(atoms)} 人（将跳过）")
    else:
        atoms = {}

    # ── 收集待处理高管 ────────────────────────────────────
    pending = []
    for company in raw:
        region = REGION_MAP.get(company.get("region", "中国大陆"), "CN")
        for e in company.get("executives", []):
            bio  = (e.get("bio") or "").strip()
            name = (e.get("name") or "").strip()
            if not name:
                continue
            key = f"{name}|{company['name']}"
            if key in atoms:
                continue
            pending.append({
                "name":    name,
                "company": company["name"],
                "title":   (e.get("title") or "").strip(),
                "region":  region,
                "bio":     bio,
            })

    skipped = len(atoms)
    total   = len(pending)
    print(f"待处理: {total} 人  已跳过: {skipped} 人\n")

    if not pending:
        print("全部已完成！")
        return

    # ── 并发处理 ──────────────────────────────────────────
    lock = threading.Lock()
    ok = fail = saved_count = 0

    def save():
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(atoms, f, ensure_ascii=False, indent=2)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(process_one, make_client(), entry, i + 1, total): entry
            for i, entry in enumerate(pending)
        }
        for future in as_completed(futures):
            key, atom = future.result()
            with lock:
                if atom is not None:
                    atoms[key] = atom
                    ok += 1
                else:
                    fail += 1
                saved_count += 1
                if saved_count % SAVE_EVERY == 0:
                    save()
                    done = ok + fail
                    print(f"\n  ── 保存进度 {done}/{total}（成功 {ok} / 失败 {fail}）──\n")

    save()

    print(f"\n{'='*55}")
    print(f"完成！成功: {ok}  失败: {fail}  跳过: {skipped}")
    print(f"bio_atoms.json 总记录: {len(atoms)} 人")
    print(f"输出文件: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
