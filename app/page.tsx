"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Executive, Relationship, Region, RelType, RoleCategory, CompanyType, Company } from "@/lib/types";
import { ROLE_CATEGORY_KEYWORDS, COMPANY_TYPE_KEYWORDS } from "@/lib/types";
import { fetchExecutives, fetchRelationships, fetchCompanies } from "@/lib/db";
import { fetchStatistics } from "@/lib/db-optimized";
import Sidebar from "@/components/Sidebar";
import FilterPanel from "@/components/FilterPanel";
import CompanyModal from "@/components/CompanyModal";
import PerformancePanel from "@/components/PerformancePanel";
import LoadingProgress from "@/components/LoadingProgress";
import WorkerForceGraph from "@/components/WorkerForceGraph";

const OptimizedForceGraph = dynamic(() => import("@/components/OptimizedForceGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-slate-900">
      <div className="text-slate-400 text-sm animate-pulse">加载图谱中…</div>
    </div>
  ),
});


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
  const [statistics, setStatistics] = useState<{
    totalExecutives: number;
    totalRelationships: number;
    regions: Record<string, number>;
    companies: Record<string, number>;
    relationshipTypes: Record<string, number>;
  } | null>(null);
  const [useWorker, setUseWorker] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        // 并行加载数据和统计信息
        const [execs, rels, comps, stats] = await Promise.all([
          fetchExecutives(),
          fetchRelationships(),
          fetchCompanies(),
          fetchStatistics()
        ]);
        
        setExecutives(execs);
        setRelationships(rels);
        setCompanies(comps);
        setStatistics(stats);
        setLoading(false);
        
        console.log(`数据加载完成: ${execs.length}个高管, ${rels.length}个关系`);
        console.log(`地区分布:`, stats.regions);
        console.log(`关系类型分布:`, stats.relationshipTypes);
      } catch (e) {
        setError(String(e));
        setLoading(false);
      }
    };

    loadData();
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
      <LoadingProgress
        totalExecutives={statistics?.totalExecutives || 1494}
        totalRelationships={statistics?.totalRelationships || 15204}
        loadedExecutives={executives.length}
        loadedRelationships={relationships.length}
      />
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
        
        {/* statistics */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            {statistics ? statistics.totalExecutives.toLocaleString() : executives.length} 名高管
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">
            {statistics ? statistics.totalRelationships.toLocaleString() : relationships.length} 条关系
          </span>
          {statistics && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">
                {Object.keys(statistics.regions).length} 个地区
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">
                {Object.keys(statistics.relationshipTypes).length} 种关系
              </span>
            </>
          )}
        </div>

        {/* mobile statistics */}
        <span className="text-xs text-slate-500 sm:hidden">
          {executives.length}高管 · {relationships.length}关系
        </span>

        {/* advanced options toggle */}
        <button
          className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors ml-2"
          onClick={() => setShowAdvancedOptions(v => !v)}
          title="高级选项"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          高级
        </button>

        {/* mobile filter toggle */}
        <button
          className="ml-auto sm:ml-2 sm:hidden flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
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
          <WorkerForceGraph
            data={graphData}
            selectedId={selectedExec?.id ?? null}
            onSelectNode={handleSelectNode}
            filterRegion={filterRegion}
            filterRelType={filterRelType}
            searchName={searchName}
            enableSampling={true}
            degreeThreshold={3}
            useWorker={useWorker}
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

      {/* performance panel */}
      <PerformancePanel />

      {/* advanced options panel */}
      {showAdvancedOptions && (
        <div className="fixed top-12 right-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl p-4 w-64 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-300 text-sm">高级选项</h3>
            <button
              onClick={() => setShowAdvancedOptions(false)}
              className="text-slate-500 hover:text-slate-300 text-sm"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* Worker 开关 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-300">Web Worker</div>
                <div className="text-xs text-slate-500">后台计算，提升性能</div>
              </div>
              <button
                onClick={() => setUseWorker(!useWorker)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useWorker ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useWorker ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 节点聚合开关 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-300">节点聚合</div>
                <div className="text-xs text-slate-500">减少渲染元素</div>
              </div>
              <div className="text-xs text-slate-400">已启用</div>
            </div>

            {/* 性能提示 */}
            <div className="pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400 mb-2">性能提示</div>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></div>
                  <span>Worker: 减少UI卡顿</span>
                </div>
                <div className="flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></div>
                  <span>节点聚合: 提升渲染速度</span>
                </div>
                <div className="flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                  <span>数据缓存: 减少查询延迟</span>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex space-x-2 pt-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded transition-colors"
              >
                刷新应用
              </button>
              <button
                onClick={() => {
                  // 清除缓存
                  if (window.confirm('确定要清除所有缓存吗？')) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                  }
                }}
                className="flex-1 text-xs bg-red-900/30 hover:bg-red-800/40 text-red-300 py-1.5 rounded transition-colors"
              >
                清除缓存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
