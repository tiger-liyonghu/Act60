"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Executive, Relationship, Region, RelType, RoleCategory, CompanyType, Company } from "@/lib/types";
import { ROLE_CATEGORY_KEYWORDS, COMPANY_TYPE_KEYWORDS } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import FilterPanel from "@/components/FilterPanel";
import CompanyModal from "@/components/CompanyModal";

const ForceGraph = dynamic(() => import("@/components/ForceGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-slate-900">
      <div className="text-slate-400 text-sm animate-pulse">加载图谱中…</div>
    </div>
  ),
});

interface RawRelationship {
  source: number;
  target: number;
  type: RelType;
  strength: number;
  label: string;
}

export default function HomePage() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedExec, setSelectedExec] = useState<Executive | null>(null);
  const [filterRegion, setFilterRegion] = useState<Region | "ALL">("ALL");
  const [filterRelType, setFilterRelType] = useState<RelType | "ALL">("ALL");
  const [filterRoleCategory, setFilterRoleCategory] = useState<RoleCategory>("ALL");
  const [filterCompanyType, setFilterCompanyType] = useState<CompanyType>("ALL");
  const [searchName, setSearchName] = useState("");
  const [companyModalTarget, setCompanyModalTarget] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false); // mobile filter drawer

  // load data
  useEffect(() => {
    Promise.all([
      fetch("/data/executives.json").then((r) => r.json()),
      fetch("/data/relationships.json").then((r) => r.json()),
      fetch("/data/companies.json").then((r) => r.json()).catch(() => []),
    ])
      .then(([execs, rels, comps]: [Executive[], RawRelationship[], Company[]]) => {
        setExecutives(execs);
        setRelationships(rels as unknown as Relationship[]);
        setCompanies(comps ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  // filtered graph data (memoized)
  const graphData = useMemo(() => {
    const searchLower = searchName.toLowerCase();
    const roleKeywords = ROLE_CATEGORY_KEYWORDS[filterRoleCategory];
    const companyKeywords = COMPANY_TYPE_KEYWORDS[filterCompanyType];
    const nodes = executives.filter((n) => {
      if (filterRegion !== "ALL" && n.region !== filterRegion) return false;
      if (companyKeywords.length > 0 && !companyKeywords.some((kw) => n.company.includes(kw))) return false;
      if (roleKeywords.length > 0 && !roleKeywords.some((kw) => n.title.includes(kw))) return false;
      if (
        searchLower &&
        !n.name.toLowerCase().includes(searchLower) &&
        !n.company.toLowerCase().includes(searchLower) &&
        !n.extracted.schools.some((s) => s.toLowerCase().includes(searchLower))
      )
        return false;
      return true;
    });
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = relationships.filter((l) => {
      const sid = typeof l.source === "object" ? (l.source as Executive).id : (l.source as number);
      const tid = typeof l.target === "object" ? (l.target as Executive).id : (l.target as number);
      if (!nodeIds.has(sid) || !nodeIds.has(tid)) return false;
      if (filterRelType !== "ALL" && l.type !== filterRelType) return false;
      return true;
    });
    return { nodes, links };
  }, [executives, relationships, filterRegion, filterRelType, filterRoleCategory, filterCompanyType, searchName]);

  const handleSelectNode = useCallback((exec: Executive) => {
    setSelectedExec(exec);
    setFilterOpen(false); // close filter drawer when selecting a node on mobile
  }, []);

  const handleClose = useCallback(() => {
    setSelectedExec(null);
  }, []);

  const handleCompanyClick = useCallback((companyName: string) => {
    setCompanyModalTarget(companyName);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-300">
        <div className="text-center">
          <div className="text-2xl mb-2 animate-spin">⟳</div>
          <div>加载数据中…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-red-400">
        <div className="text-center">
          <div className="text-xl mb-2">加载失败</div>
          <div className="text-sm text-slate-500">{error}</div>
        </div>
      </div>
    );
  }

  const filterPanel = (
    <FilterPanel
      searchName={searchName}
      filterRegion={filterRegion}
      filterRelType={filterRelType}
      filterRoleCategory={filterRoleCategory}
      filterCompanyType={filterCompanyType}
      onSearch={setSearchName}
      onRegion={setFilterRegion}
      onRelType={setFilterRelType}
      onRoleCategory={setFilterRoleCategory}
      onCompanyType={setFilterCompanyType}
      nodeCount={graphData.nodes.length}
      linkCount={graphData.links.length}
    />
  );

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* top bar */}
      <header className="flex items-center px-4 py-2.5 bg-slate-800 border-b border-slate-700 flex-shrink-0 gap-3">
        <h1 className="font-bold text-sm sm:text-base text-white whitespace-nowrap">
          保险高管关系图谱
        </h1>
        <span className="text-xs text-slate-500 hidden sm:inline">
          {executives.length} 名高管 · {relationships.length} 条关系
        </span>

        {/* mobile filter toggle */}
        <button
          className="ml-auto sm:hidden flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
          onClick={() => setFilterOpen((v) => !v)}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
          </svg>
          筛选
        </button>
      </header>

      {/* body: left panel + graph + right sidebar */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Left filter panel (desktop: always visible) ── */}
        <div className="hidden sm:flex h-full">
          {filterPanel}
        </div>

        {/* ── Mobile filter overlay ── */}
        {filterOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-30 sm:hidden"
              onClick={() => setFilterOpen(false)}
            />
            <div className="fixed top-[44px] left-0 bottom-0 z-40 sm:hidden flex">
              {filterPanel}
            </div>
          </>
        )}

        {/* ── Graph ── */}
        <div className="flex-1 overflow-hidden">
          <ForceGraph
            data={graphData}
            selectedId={selectedExec?.id ?? null}
            onSelectNode={handleSelectNode}
            filterRegion={filterRegion}
            filterRelType={filterRelType}
            searchName={searchName}
          />
        </div>

        {/* ── Right sidebar ── */}
        {selectedExec && (
          <>
            {/* mobile backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-30 sm:hidden"
              onClick={handleClose}
            />
            <div className="
              fixed inset-x-0 bottom-0 z-40 h-[75vh]
              sm:static sm:inset-auto sm:z-auto sm:h-auto
              w-full sm:w-80 flex-shrink-0 overflow-hidden
            ">
              <Sidebar
                exec={selectedExec}
                allLinks={relationships}
                allExecs={executives}
                onSelectNode={handleSelectNode}
                onClose={handleClose}
                onCompanyClick={handleCompanyClick}
              />
            </div>
          </>
        )}
      </div>

      {/* company modal */}
      <CompanyModal
        companyName={companyModalTarget}
        companies={companies}
        executives={executives}
        onClose={() => setCompanyModalTarget(null)}
        onSelectExec={handleSelectNode}
      />
    </div>
  );
}
