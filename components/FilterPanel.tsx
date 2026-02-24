"use client";

import type { Region, RelType, RoleCategory, CompanyType } from "@/lib/types";
import { REL_COLOR, REGION_COLOR, ROLE_CATEGORY_LABEL, COMPANY_TYPE_LABEL } from "@/lib/types";

interface Props {
  searchName: string;
  filterRegion: Region | "ALL";
  filterRelType: RelType | "ALL";
  filterRoleCategory: RoleCategory;
  filterCompanyType: CompanyType;
  onSearch: (v: string) => void;
  onRegion: (v: Region | "ALL") => void;
  onRelType: (v: RelType | "ALL") => void;
  onRoleCategory: (v: RoleCategory) => void;
  onCompanyType: (v: CompanyType) => void;
  nodeCount: number;
  linkCount: number;
}

const REGIONS: Array<{ value: Region | "ALL"; label: string }> = [
  { value: "ALL", label: "全部地区" },
  { value: "CN", label: "中国大陆" },
  { value: "HK", label: "中国香港" },
  { value: "SG", label: "新加坡" },
];

const REL_TYPES: Array<{ value: RelType | "ALL"; label: string }> = [
  { value: "ALL", label: "全部关系" },
  { value: "colleague", label: "同事" },
  { value: "alumni", label: "校友" },
  { value: "former", label: "前同事" },
  { value: "regulator", label: "监管背景" },
];

const COMPANY_TYPES: Array<{ value: CompanyType; label: string }> = [
  { value: "ALL", label: COMPANY_TYPE_LABEL.ALL },
  { value: "nonlife", label: COMPANY_TYPE_LABEL.nonlife },
  { value: "life", label: COMPANY_TYPE_LABEL.life },
];

const ROLE_CATS: Array<{ value: RoleCategory; label: string }> = [
  { value: "ALL", label: ROLE_CATEGORY_LABEL.ALL },
  { value: "board", label: ROLE_CATEGORY_LABEL.board },
  { value: "exec", label: ROLE_CATEGORY_LABEL.exec },
  { value: "chief", label: ROLE_CATEGORY_LABEL.chief },
  { value: "actuary", label: ROLE_CATEGORY_LABEL.actuary },
];

export default function FilterPanel({
  searchName,
  filterRegion,
  filterRelType,
  filterRoleCategory,
  filterCompanyType,
  onSearch,
  onRegion,
  onRelType,
  onRoleCategory,
  onCompanyType,
  nodeCount,
  linkCount,
}: Props) {
  return (
    <div className="flex flex-col bg-slate-800 border-b border-slate-700">
      {/* row 1: search + stats */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center bg-slate-700 rounded-lg px-3 gap-2 flex-1 min-w-0">
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchName}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="搜索姓名/公司/院校..."
            className="bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none py-1.5 w-full"
          />
          {searchName && (
            <button onClick={() => onSearch("")} className="text-slate-500 hover:text-white text-xs flex-shrink-0">✕</button>
          )}
        </div>
        <div className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
          {nodeCount}人·{linkCount}条
        </div>
      </div>

      {/* row 2: region + rel type (scrollable on mobile) */}
      <div className="overflow-x-auto scrollbar-none border-t border-slate-700/50">
        <div className="flex items-center gap-1 px-3 py-1.5 min-w-max">
          {/* region */}
          {REGIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onRegion(value)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium whitespace-nowrap ${
                filterRegion === value
                  ? "text-white bg-slate-600"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {value !== "ALL" && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                  style={{ background: REGION_COLOR[value as Region] }}
                />
              )}
              {label}
            </button>
          ))}

          <div className="w-px h-4 bg-slate-600 mx-1 flex-shrink-0" />

          {/* rel type */}
          {REL_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onRelType(value)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium whitespace-nowrap ${
                filterRelType === value
                  ? "text-white bg-slate-600"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {value !== "ALL" && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                  style={{ background: REL_COLOR[value as RelType] }}
                />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* row 3: company type + role category (scrollable on mobile) */}
      <div className="overflow-x-auto scrollbar-none border-t border-slate-700/50">
        <div className="flex items-center gap-1 px-3 py-1.5 min-w-max">
          <span className="text-xs text-slate-500 mr-0.5 flex-shrink-0">险种：</span>
          {COMPANY_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onCompanyType(value)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium whitespace-nowrap ${
                filterCompanyType === value
                  ? "text-white bg-teal-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}

          <div className="w-px h-4 bg-slate-600 mx-1 flex-shrink-0" />

          <span className="text-xs text-slate-500 mr-0.5 flex-shrink-0">职位：</span>
          {ROLE_CATS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onRoleCategory(value)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium whitespace-nowrap ${
                filterRoleCategory === value
                  ? "text-white bg-indigo-600"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
