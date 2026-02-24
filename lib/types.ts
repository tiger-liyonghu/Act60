export type Region = "CN" | "HK" | "SG";
export type RelType = "colleague" | "alumni" | "former" | "regulator" | "successor";
export type RoleCategory = "ALL" | "board" | "exec" | "chief" | "actuary" | "supervisor";
export type CompanyType = "ALL" | "nonlife" | "life";

export interface CareerStep {
  company: string;
  title: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
}

export interface EducationRecord {
  school: string | null;
  degree: string | null;
  major: string | null;
  year: number | null;
}

export interface BoardRole {
  company: string;
  role: string;
  is_current: boolean;
}

export interface Executive {
  id: number;
  name: string;
  title: string;
  company: string;
  region: Region;
  website: string;
  bio: string;
  extracted: {
    schools: string[];
    former_companies: string[];
    regulator_bg: string[];
  };
  career_path?: CareerStep[];
  // 原子化字段（来自 bio_atoms）
  identity?: { birth_year: number | null; gender: string | null };
  education?: EducationRecord[];
  qualifications?: string[];
  board_roles?: BoardRole[];
  industry_roles?: string[];
  // runtime fields added after data load
  degree?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface Relationship {
  source: number | Executive;
  target: number | Executive;
  type: RelType;
  strength: number;
  label: string;
}

export interface GraphData {
  nodes: Executive[];
  links: Relationship[];
}

export interface Company {
  name: string;
  short_name: string;
  website: string;
  region: Region;
  intro: string;
  fetched_url: string;
}

export const REGION_COLOR: Record<Region, string> = {
  CN: "#3b82f6", // blue-500
  HK: "#22c55e", // green-500
  SG: "#f97316", // orange-500
};

export const REL_COLOR: Record<RelType, string> = {
  colleague: "#94a3b8",  // slate-400
  alumni:    "#a78bfa",  // violet-400
  former:    "#fb923c",  // orange-400
  regulator: "#34d399",  // emerald-400
  successor: "#f43f5e",  // rose-500
};

export const REL_LABEL: Record<RelType, string> = {
  colleague: "同事",
  alumni:    "校友",
  former:    "前同事",
  regulator: "监管背景",
  successor: "前后任",
};

export const ROLE_CATEGORY_KEYWORDS: Record<RoleCategory, string[]> = {
  ALL: [],
  board:      ["董事长", "执行董事", "独立董事", "非执行董事", "董事总经理", "副董事长", "独立非执行董事"],
  exec:       ["总裁", "总经理", "副总裁", "副总经理", "联席总裁", "联席总经理"],
  chief:      ["首席执行官", "首席财务官", "首席风险官", "首席投资官", "首席信息官",
               "首席运营官", "首席合规官", "首席分销官", "首席财务总监", "首席技术官"],
  actuary:    ["总精算师", "首席精算师", "集团精算师", "精算师", "精算总监", "精算"],
  supervisor: ["监事长", "副监事长", "监事"],
};

export const COMPANY_TYPE_KEYWORDS: Record<CompanyType, string[]> = {
  ALL: [],
  nonlife: ["财产", "财险", "产险", "农业保险", "汽车保险", "航运保险", "火灾保险",
            "信用保证", "出口信用", "安达保险", "苏黎世", "中银保险", "利宝保险", "劳合社",
            "General", "Sompo", "Chubb", "Zurich", "Tokio Marine", "Taiping Insurance Singapore"],
  life:    ["人寿", "寿险", "健康", "养老", "人身", "恒生保险",
            "Life", "AIA", "Manulife", "Prudential", "FWD", "Singlife", "Great Eastern"],
};

export const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  ALL:     "所有公司",
  nonlife: "财险",
  life:    "寿险健康险",
};

export const ROLE_CATEGORY_LABEL: Record<RoleCategory, string> = {
  ALL:        "全部职位",
  board:      "董事会",
  exec:       "高管",
  chief:      "首席官",
  actuary:    "精算师",
  supervisor: "监事会",
};
