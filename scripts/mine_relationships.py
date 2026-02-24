#!/usr/bin/env python3
"""
mine_relationships.py
从 bio_atoms.json（LLM 原子化数据库）和 00_全部数据.json 挖掘高管关系，生成：
  - ../public/data/executives.json
  - ../public/data/relationships.json
"""

import json
import re
import os
from collections import defaultdict
from itertools import combinations

# ── 路径配置 ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(SCRIPT_DIR, "..", "public", "data")
SOURCE_FILE = os.path.join(SCRIPT_DIR, "..", "..", "Actuary60", "00_全部数据.json")
BIO_ATOMS_FILE = os.path.join(SCRIPT_DIR, "bio_atoms.json")

os.makedirs(DATA_DIR, exist_ok=True)

# ── 加载规范名称库 ─────────────────────────────────────────
CANONICAL_FILE = os.path.join(SCRIPT_DIR, "canonical_names.json")
_canonical_raw = {}
if os.path.exists(CANONICAL_FILE):
    with open(CANONICAL_FILE, encoding="utf-8") as f:
        _canonical_raw = json.load(f)

CANONICAL: dict[str, dict[str, str]] = {}
for section, mapping in _canonical_raw.items():
    if section.startswith("_"):
        continue
    CANONICAL[section] = {k: v for k, v in mapping.items() if k != "说明"}

def apply_canonical(names: list[str], section: str) -> list[str]:
    """将名称列表中的变体替换为规范名称，同时去重保序。"""
    mapping = CANONICAL.get(section, {})
    seen, result = set(), []
    for n in names:
        canonical = mapping.get(n, n)
        if canonical not in seen:
            seen.add(canonical)
            result.append(canonical)
    return result

# ── 加载 bio_atoms（LLM 原子化数据库）────────────────────
if not os.path.exists(BIO_ATOMS_FILE):
    print(f"错误：未找到 bio_atoms.json，请先运行 parse_bios_llm.py")
    import sys; sys.exit(1)

with open(BIO_ATOMS_FILE, encoding="utf-8") as f:
    bio_atoms: dict = json.load(f)
print(f"加载 bio_atoms: {len(bio_atoms)} 人")

# ── 加载原始数据 ──────────────────────────────────────────
with open(SOURCE_FILE, encoding="utf-8") as f:
    raw = json.load(f)
print(f"加载源数据: {len(raw)} 家公司")

# ── 规范公司名集合 ─────────────────────────────────────────
company_names_set = {company["name"] for company in raw}

# 合法机构全集 = 当前雇主 + canonical_names.json companies 的所有 value
_canon_companies = CANONICAL.get("companies", {})
all_canonical_companies: set[str] = set(company_names_set)
for k, v in _canon_companies.items():
    if not k.startswith("_") and k != "说明":
        all_canonical_companies.add(v)
_company_variant_map: dict[str, str] = {
    k: v for k, v in _canon_companies.items()
    if not k.startswith("_") and k != "说明"
}

# ── 地区映射 ──────────────────────────────────────────────
REGION_MAP = {"中国大陆": "CN", "中国香港": "HK", "新加坡": "SG"}

# ── 职位标准化 ────────────────────────────────────────────
EN_TITLE_MAP = {
    "Chief Executive Officer": "首席执行官",
    "Group Chief Executive Officer": "集团首席执行官",
    "Regional CEO": "区域首席执行官",
    "Chief Financial Officer": "首席财务官",
    "Group Chief Financial Officer": "集团首席财务官",
    "Chief Risk Officer": "首席风险官",
    "Chief Investment Officer": "首席投资官",
    "Chief Information Officer": "首席信息官",
    "Chief Operating Officer": "首席运营官",
    "Chief Distribution Officer": "首席分销官",
    "Chief Compliance Officer": "首席合规官",
    "Managing Director": "董事总经理",
    "MD": "董事总经理",
    "Director": "董事",
    "Independent Director": "独立董事",
    "Independent Non-Executive Director": "独立非执行董事",
    "Non-Executive Director": "非执行董事",
    "Executive Director": "执行董事",
    "Chairman": "董事长",
    "Vice Chairman": "副董事长",
    "President": "总裁",
    "CEO": "首席执行官",
    "CFO": "首席财务官",
    "行政總裁": "首席执行官",
    "首席財務總監": "首席财务总监",
    "先生": "", "女士": "", "Singapore": "",
}

_APPROVAL_RE    = re.compile(r'（(?:批复文号|保监许可|[^\u4e00-\u9fa5（）]{0,4})[^）]*[号〕\d][^）]*）')
_BIO_OVERFLOW_RE = re.compile(r'。[\u4e00-\u9fa5]{1,3}(?:先生|女士|曾任|拥有|毕业|持有|出生).+$')
_INNER_SPACE_RE  = re.compile(r'([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])')
_UNKNOWN_COMP_RE = re.compile(
    r'^([\u4e00-\u9fa5]{2,12}'
    r'(?:保险社|人寿|财产|保险|集团|银行|证券|资产|基金|再保险)'
    r'(?:股份有限公司|有限公司|有限责任公司|股份公司)?)'
    r'(.{2,})$'
)
_BRANCH_RE    = re.compile(r'^[\u4e00-\u9fa5]{1,6}(?:省|市|区|地区|自治区)?分公司')
_MULTI_COMP_RE = re.compile(r'[，,][\u4e00-\u9fa5]{2,12}(?:保险|集团|公司|银行|资产|基金).+$')


def normalize_title(raw_title: str, known_companies: set = None) -> str:
    if not raw_title:
        return ""
    known_companies = known_companies or set()
    t = raw_title.strip()
    while _INNER_SPACE_RE.search(t):
        t = _INNER_SPACE_RE.sub(r'\1\2', t)
    if t in EN_TITLE_MAP:
        return EN_TITLE_MAP[t]
    t = _APPROVAL_RE.sub("", t)
    t = _BIO_OVERFLOW_RE.sub("", t)
    t = t.rstrip("。！？，., ").strip()
    for pfx in ["现任本公司", "现任公司", "本公司", "现任"]:
        if t.startswith(pfx):
            t = t[len(pfx):].strip()
            break
    if t.startswith("兼任"):
        t = t[2:].strip()
    stripped = False
    for comp in sorted(known_companies, key=len, reverse=True):
        if t.startswith(comp):
            rest = t[len(comp):].strip()
            if len(rest) >= 2:
                t = rest
                stripped = True
            break
    if not stripped:
        m = _UNKNOWN_COMP_RE.match(t)
        if m and len(m.group(2)) >= 2:
            t = m.group(2).strip()
    for pfx in ["公司党委", "集团党委", "公司", "集团"]:
        if t.startswith(pfx) and len(t) > len(pfx) + 1:
            t = t[len(pfx):].strip()
            break
    t = _MULTI_COMP_RE.sub("", t)
    m = _BRANCH_RE.match(t)
    if m:
        t = "分公司" + t[m.end():]
    return t.rstrip("。！？，., ").strip()


# ── 公司名匹配（用于 LLM 提取的历史公司 → 标准名）────────
def normalize_company(name, known_set):
    if name in known_set:
        return name
    if len(name) >= 8:
        for known in known_set:
            if name in known:
                return known
            if known in name and len(name) <= len(known) + 4:
                return known
    return None

def match_company(raw_name: str) -> str | None:
    """将 LLM 提取的公司名匹配到标准机构库"""
    name = (raw_name or "").strip()
    if not name or len(name) < 4:
        return None
    if name in _company_variant_map:
        return _company_variant_map[name]
    if name in all_canonical_companies:
        return name
    return normalize_company(name, all_canonical_companies)


# ── 前后任相关 ────────────────────────────────────────────
KEY_ROLES = [
    "董事长", "总裁", "总经理", "联席总裁", "副董事长", "副总裁", "副总经理",
    "监事长", "总精算师", "总会计师", "首席执行官", "首席风险官", "首席财务官",
    "首席投资官", "CEO", "CFO", "CRO", "CIO", "董事总经理", "党委书记", "党委副书记"
]
ROLE_INVALID_SUFFIX = ("助理", "级", "助")
ROLE_INVALID_PREFIX = {"部", "室", "组", "处"}


def extract_key_roles(title_str):
    found, remaining = [], title_str
    for role in sorted(KEY_ROLES, key=len, reverse=True):
        idx = remaining.find(role)
        while idx >= 0:
            next_chars = remaining[idx + len(role): idx + len(role) + 2]
            if any(next_chars.startswith(s) for s in ROLE_INVALID_SUFFIX):
                idx = remaining.find(role, idx + 1)
                continue
            if idx > 0 and any(c in ROLE_INVALID_PREFIX for c in remaining[max(0, idx - 2):idx]):
                idx = remaining.find(role, idx + 1)
                continue
            found.append(role)
            remaining = remaining[:idx] + "〇" * len(role) + remaining[idx + len(role):]
            break
    return found


# ── 构建高管列表 ──────────────────────────────────────────
executives = []
exec_id    = 0
company_to_execs = defaultdict(list)

for company in raw:
    company_name = company["name"]
    region = REGION_MAP.get(company.get("region", "中国大陆"), "CN")
    website = company.get("website", "")

    for e in company.get("executives", []):
        name  = (e.get("name") or "").strip()
        title = normalize_title(e.get("title") or "", known_companies=company_names_set)
        bio   = (e.get("bio") or "").strip()

        if not name:
            continue

        # ── 从 bio_atoms 读取原子字段 ─────────────────────
        atom_key = f"{name}|{company_name}"
        atom     = bio_atoms.get(atom_key, {})

        # 院校：从 education[].school 提取，过滤空值，应用规范化
        schools_raw = [
            edu["school"] for edu in atom.get("education", [])
            if edu.get("school") and len(edu["school"]) >= 4
        ]
        schools = apply_canonical(list(dict.fromkeys(schools_raw)), "schools")

        # 曾任公司：career 中 is_current=False 的条目，匹配到标准机构库
        former_companies = []
        for step in atom.get("career", []):
            if step.get("is_current"):
                continue
            canonical = match_company(step.get("company", ""))
            if canonical and canonical != company_name:
                former_companies.append(canonical)
        # board_roles 中也可能有曾经的（如果标注为 is_current=False）
        for br in atom.get("board_roles", []):
            if br.get("is_current"):
                continue
            canonical = match_company(br.get("company", ""))
            if canonical and canonical != company_name and canonical not in former_companies:
                former_companies.append(canonical)
        former_companies = list(dict.fromkeys(former_companies))  # 去重保序
        former_companies = apply_canonical(former_companies, "companies")

        # 监管背景
        regulator_bg = apply_canonical(atom.get("regulator_bg", []), "regulators")

        # 职业轨迹 career_path：直接使用 LLM 结果
        career_path = atom.get("career", [
            {"company": company_name, "title": title,
             "start_year": None, "end_year": None, "is_current": True}
        ])

        exec_obj = {
            "id":      exec_id,
            "name":    name,
            "title":   title,
            "company": company_name,
            "region":  region,
            "website": website,
            "bio":     bio,
            "extracted": {
                "schools":          schools,
                "former_companies": former_companies,
                "regulator_bg":     regulator_bg,
            },
            "career_path": career_path,
            # 额外原子字段（供前端侧边栏使用）
            "identity":       atom.get("identity", {}),
            "education":      atom.get("education", []),
            "qualifications": atom.get("qualifications", []),
            "board_roles":    atom.get("board_roles", []),
            "industry_roles": atom.get("industry_roles", []),
        }
        executives.append(exec_obj)
        company_to_execs[company_name].append(exec_id)
        exec_id += 1

print(f"高管总数: {len(executives)}")
bio_atoms_coverage = sum(1 for e in executives if f"{e['name']}|{e['company']}" in bio_atoms)
print(f"bio_atoms 覆盖: {bio_atoms_coverage}/{len(executives)} 人")

# ── 关系字典（去重用） ──────────────────────────────────────
relationships_dict = {}

def add_rel(id_a, id_b, rel_type, strength, label):
    key = frozenset([id_a, id_b])
    if key in relationships_dict:
        if strength > relationships_dict[key]["strength"]:
            relationships_dict[key] = {"source": id_a, "target": id_b,
                                       "type": rel_type, "strength": strength, "label": label}
    else:
        relationships_dict[key] = {"source": id_a, "target": id_b,
                                   "type": rel_type, "strength": strength, "label": label}

# ── 1. colleague：同公司高管 ──────────────────────────────
print("挖掘 colleague 关系...")
colleague_count = 0
for comp, ids in company_to_execs.items():
    ids_limited = ids[:30]
    for a, b in combinations(ids_limited, 2):
        add_rel(a, b, "colleague", 1.0, comp)
        colleague_count += 1
print(f"  colleague: {colleague_count} 对")

# ── 2. alumni：相同院校 ──────────────────────────────────
print("挖掘 alumni 关系...")
school_to_execs = defaultdict(list)
for e in executives:
    for school in e["extracted"]["schools"]:
        if len(school) >= 4:
            school_to_execs[school].append(e["id"])

alumni_count = 0
for school, ids in school_to_execs.items():
    if len(ids) < 2:
        continue
    ids_limited = ids[:50]
    for a, b in combinations(ids_limited, 2):
        add_rel(a, b, "alumni", 0.7, school)
        alumni_count += 1
print(f"  alumni: {alumni_count} 对 (来自 {len(school_to_execs)} 所院校)")

# ── 3. former：曾任同一公司 ───────────────────────────────
print("挖掘 former 关系...")
former_comp_to_execs = defaultdict(list)
for e in executives:
    for fc in e["extracted"]["former_companies"]:
        if len(fc) >= 4:
            former_comp_to_execs[fc].append(e["id"])

former_count = 0
for fc, ids in former_comp_to_execs.items():
    if len(ids) < 2:
        continue
    ids_limited = ids[:50]
    for a, b in combinations(ids_limited, 2):
        add_rel(a, b, "former", 0.6, fc)
        former_count += 1
print(f"  former: {former_count} 对 (来自 {len(former_comp_to_execs)} 家历史公司)")

# ── 4. regulator：共同监管机构背景 ───────────────────────
print("挖掘 regulator 关系...")
regulator_execs = defaultdict(list)
for e in executives:
    for kw in e["extracted"]["regulator_bg"]:
        regulator_execs[kw].append(e["id"])

regulator_count = 0
for kw, ids in regulator_execs.items():
    if len(ids) < 2:
        continue
    ids_limited = ids[:50]
    for a, b in combinations(ids_limited, 2):
        add_rel(a, b, "regulator", 0.4, kw)
        regulator_count += 1
print(f"  regulator: {regulator_count} 对")

# ── 5. successor：同公司同职位前后任 ──────────────────────
print("挖掘 successor 关系...")
role_index = defaultdict(lambda: {"current": [], "former": []})
seen_former_person = set()

for e in executives:
    current_roles = extract_key_roles(e["title"])
    for role in current_roles:
        role_index[(e["company"], role)]["current"].append(e["id"])
    current_exec_roles = set(extract_key_roles(e["title"]))
    for step in e.get("career_path", []):
        if not step.get("is_current") and step.get("company") in company_names_set:
            step_roles = extract_key_roles(step.get("title") or "")
            for role in step_roles:
                if e["company"] == step["company"] and role in current_exec_roles:
                    continue
                dedup_key = (e["name"], step["company"], role)
                if dedup_key not in seen_former_person:
                    seen_former_person.add(dedup_key)
                    role_index[(step["company"], role)]["former"].append(e["id"])

successor_dict = {}
successor_count = 0
for (comp, role), groups in role_index.items():
    current_ids, former_ids = groups["current"], groups["former"]
    if not current_ids or not former_ids:
        continue
    for curr_id in current_ids:
        for form_id in former_ids:
            if curr_id != form_id:
                key = (form_id, curr_id)
                if key not in successor_dict:
                    successor_dict[key] = {
                        "source": form_id, "target": curr_id,
                        "type": "successor", "strength": 0.8,
                        "label": f"{comp[:8]}·{role}",
                    }
                    successor_count += 1
print(f"  successor: {successor_count} 条")

# ── 输出 ──────────────────────────────────────────────────
relationships = list(relationships_dict.values())
print(f"\n关系总数（去重后）: {len(relationships)}")

type_count = defaultdict(int)
for r in relationships:
    type_count[r["type"]] += 1
for t, c in sorted(type_count.items()):
    print(f"  {t}: {c}")

# 写出文件
out_exec = os.path.join(DATA_DIR, "executives.json")
out_rel  = os.path.join(DATA_DIR, "relationships.json")

with open(out_exec, "w", encoding="utf-8") as f:
    json.dump(executives, f, ensure_ascii=False, indent=2)
print(f"\n已写出: {out_exec}")

with open(out_rel, "w", encoding="utf-8") as f:
    json.dump(relationships, f, ensure_ascii=False, indent=2)
print(f"已写出: {out_rel}")

print("\n完成！")
