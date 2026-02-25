"""
config.py — 全球保险精英高管数据采集管道配置

使用前请在环境变量中设置：
  LLM_API_KEY      = DeepSeek / OpenAI 兼容 API Key
  LLM_API_URL      = API 地址（默认 DeepSeek）
  LLM_MODEL        = 模型名（默认 deepseek-chat）
  JINA_API_KEY     = Jina Reader API Key（可选，不设置则用免费额度）
  SUPABASE_SERVICE_KEY = Supabase Service Role Key（上传时需要）
"""

import os
from pathlib import Path

# ==================== 路径配置 ====================
SCRIPTS_DIR = Path(__file__).parent.parent
DATA_DIR    = SCRIPTS_DIR / "data"
RAW_DIR     = SCRIPTS_DIR / "raw"
DATA_DIR.mkdir(exist_ok=True)
RAW_DIR.mkdir(exist_ok=True)

# ==================== API 配置 ====================
JINA_BASE_URL    = "https://r.jina.ai/"
JINA_API_KEY     = os.environ.get("JINA_API_KEY", "")
FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")

# LLM_API_KEY 优先，其次自动检测 DEEPSEEK_API_KEY
LLM_API_URL = os.environ.get("LLM_API_URL", "https://api.deepseek.com/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY", "")
LLM_MODEL   = os.environ.get("LLM_MODEL", "deepseek-chat")

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "https://czzdtudtuiauhfvjdqpk.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ==================== 市场配置 ====================
# 每个市场的监管机构官网，作为「找所有保司」的权威来源
MARKETS = {
    "HK": {
        "name": "香港",
        "name_en": "Hong Kong",
        "regulator_name": "Insurance Authority",
        "regulator_url": "https://www.ia.org.hk/en/licencee/register.html",
        "regulator_note": "IA 公开的持牌保险公司注册名单",
    },
    "SG": {
        "name": "新加坡",
        "name_en": "Singapore",
        "regulator_name": "Monetary Authority of Singapore",
        "regulator_url": "https://www.mas.gov.sg/regulation/insurance/list-of-insurers-licensed-in-singapore",
        "regulator_note": "MAS 公开的持牌保险商名单",
    },
}

# ==================== Bio 判断标准 ====================
# 用户确认：≥2 句话 + 含职业背景，且职位为 C-suite / VP 及以上
BIO_CRITERIA = {
    # 最少句数（只有「姓名 + 职位」不算 bio）
    "min_sentences": 2,

    # bio 必须含有至少一个职业背景关键词
    "background_keywords": [
        # 英文
        "year", "years", "experience", "previously", "prior to",
        "former", "joined", "served", "degree", "university",
        "qualified", "appointed", "graduated", "professional",
        "career", "worked", "held",
        # 中文
        "年", "毕业", "曾任", "加入", "历任", "担任", "多年",
        "曾经", "前任", "就职",
    ],

    # 职位纳入范围（英文，大小写不敏感匹配）
    "included_titles": [
        "chief executive", "ceo",
        "chief financial", "cfo",
        "chief operating", "coo",
        "chief risk", "cro",
        "chief marketing", "cmo",
        "chief technology", "cto",
        "chief investment", "cio",
        "chief actuary",
        "chief underwriting",
        "president",
        "managing director",
        "chairman", "chairperson", "chair",
        "vice president", "vp",
        "senior vice president", "svp",
        "executive vice president", "evp",
        "head of",
        "general manager",
        # 监管机构职位
        "commissioner", "superintendent", "deputy commissioner",
        "assistant commissioner", "executive director",
        # 中文
        "首席执行官", "行政总裁",
        "首席财务官", "财务总监",
        "首席运营官", "首席风险官", "首席投资官",
        "总裁", "董事长", "总经理",
        "副总裁", "副总经理", "副总裁",
        "监管", "专员", "执行董事",
    ],

    # 排除的职位（不采集，即使出现也跳过）
    "excluded_titles": [
        "non-executive director",
        "independent director",
        "manager",
        "associate",
        "analyst",
        "advisor",
        "consultant",
        "secretary",
    ],
}

# ==================== 领导层页面发现 ====================
# 从公司首页导航中识别领导层页面时的参考关键词
LEADERSHIP_NAV_KEYWORDS = [
    "leadership", "management", "executive", "board", "our team",
    "senior management", "management team", "about us",
]

# 如果 LLM 从首页识别失败，按顺序尝试以下 URL 模式
LEADERSHIP_URL_PATTERNS = [
    "/en/about/leadership",
    "/en/about-us/our-leadership",
    "/en/about-us/leadership",
    "/en/about-us/management-team",
    "/en/about-us/our-team",
    "/en/about/our-team",
    "/en/about/management",
    "/en/corporate/leadership",
    "/en/corporate/management",
    "/about/leadership",
    "/about-us/leadership",
    "/about-us/management-team",
    "/about-us/our-team",
    "/about/team",
    "/leadership",
    "/management-team",
    "/our-leadership",
    "/our-team",
]
