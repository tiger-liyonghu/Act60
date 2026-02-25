"use client";

import type { Region, RelType, RoleCategory, CompanyType } from "@/lib/types";
import { REL_COLOR, REGION_COLOR, ROLE_CATEGORY_LABEL, COMPANY_TYPE_LABEL } from "@/lib/types";
import { useLanguage } from "@/lib/i18n-simple";

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
  { value: "ALL", label: "全部" },
  { value: "CN", label: "中国大陆" },
  { value: "HK", label: "中国香港" },
  { value: "SG", label: "新加坡" },
];

const REL_TYPES: Array<{ value: RelType | "ALL"; label: string }> = [
  { value: "ALL", label: "全部" },
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
  { value: "management", label: ROLE_CATEGORY_LABEL.management },
  { value: "actuary", label: ROLE_CATEGORY_LABEL.actuary },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 mt-4 first:mt-0 px-1">
      {children}
    </div>
  );
}

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
  const { t } = useLanguage();
  
  return (
    <div className="flex flex-col h-full bg-slate-800 border-r border-slate-700 w-44 flex-shrink-0 overflow-y-auto">
      <div className="flex flex-col gap-0 p-3 flex-1">

        {/* Search */}
        <div className="flex items-center bg-slate-700 rounded-lg px-2.5 gap-1.5 mb-3">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchName}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="姓名/公司/学校"
            className="bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none py-1.5 w-full"
          />
          {searchName && (
            <button onClick={() => onSearch("")} className="text-slate-500 hover:text-white text-xs flex-shrink-0">✕</button>
          )}
        </div>

        {/* Region */}
        <SectionLabel>{t.filters.region}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {REGIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onRegion(value)}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${
                filterRegion === value
                  ? "text-white bg-slate-600"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {value !== "ALL" ? (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: REGION_COLOR[value as Region] }}
                />
              ) : (
                <span className="w-2 h-2 flex-shrink-0" />
              )}
              {label}
            </button>
          ))}
        </div>

        {/* Rel type */}
        <SectionLabel>{t.filters.relationship}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {REL_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onRelType(value)}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${
                filterRelType === value
                  ? "text-white bg-slate-600"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {value !== "ALL" ? (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: REL_COLOR[value as RelType] }}
                />
              ) : (
                <span className="w-2 h-2 flex-shrink-0" />
              )}
              {label}
            </button>
          ))}
        </div>

        {/* Company type */}
        <SectionLabel>{t.filters.companyType}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {COMPANY_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onCompanyType(value)}
              className={`text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${
                filterCompanyType === value
                  ? "text-white bg-teal-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Role category */}
        <SectionLabel>{t.filters.position}</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {ROLE_CATS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onRoleCategory(value)}
              className={`text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${
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

      {/* Stats */}
      <div className="px-3 py-2 border-t border-slate-700 text-[11px] text-slate-500 flex-shrink-0">
        {nodeCount} {t.stats.executives} · {linkCount} {t.stats.relationships}
      </div>
    </div>
  );
}
