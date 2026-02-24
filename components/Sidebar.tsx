"use client";

import { useState, useEffect, useRef } from "react";
import type { Executive, Relationship, RelType } from "@/lib/types";
import { REGION_COLOR, REL_COLOR, REL_LABEL } from "@/lib/types";

interface Props {
  exec: Executive | null;
  allLinks: Relationship[];
  allExecs: Executive[];
  onSelectNode: (exec: Executive) => void;
  onClose: () => void;
  onCompanyClick?: (companyName: string) => void;
}

// ── localStorage 工具 ────────────────────────────────────
const LS_KNOWN  = "g_known_execs";   // Set<string>  "id|name|company"
const LS_ERRORS = "g_error_reports"; // ErrorReport[]

interface ErrorReport {
  execId: number;
  name: string;
  company: string;
  field: string;
  desc: string;
  ts: string;
}

function getKnownSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KNOWN) || "[]")); }
  catch { return new Set(); }
}
function saveKnownSet(s: Set<string>) {
  localStorage.setItem(LS_KNOWN, JSON.stringify(Array.from(s)));
}
function getReports(): ErrorReport[] {
  try { return JSON.parse(localStorage.getItem(LS_ERRORS) || "[]"); }
  catch { return []; }
}
function saveReport(r: ErrorReport) {
  const list = getReports();
  list.unshift(r);
  localStorage.setItem(LS_ERRORS, JSON.stringify(list));
}

export default function Sidebar({ exec, allLinks, allExecs, onSelectNode, onClose, onCompanyClick }: Props) {
  const [careerExpanded, setCareerExpanded] = useState(false);
  const [isKnown, setIsKnown]               = useState(false);
  const [showReport, setShowReport]         = useState(false);
  const [reportField, setReportField]       = useState("职业轨迹");
  const [reportDesc, setReportDesc]         = useState("");
  const [reportDone, setReportDone]         = useState(false);
  const reportRef = useRef<HTMLTextAreaElement>(null);

  // 每次切换人物时同步 isKnown 状态
  useEffect(() => {
    if (!exec) return;
    const key = `${exec.id}|${exec.name}|${exec.company}`;
    setIsKnown(getKnownSet().has(key));
    setShowReport(false);
    setReportDesc("");
    setReportDone(false);
  }, [exec?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!exec) return null;

  // 我认识TA 切换
  function toggleKnown() {
    const key = `${exec!.id}|${exec!.name}|${exec!.company}`;
    const s = getKnownSet();
    if (s.has(key)) { s.delete(key); setIsKnown(false); }
    else            { s.add(key);    setIsKnown(true);  }
    saveKnownSet(s);
  }

  // 提交报错
  function submitReport() {
    if (!reportDesc.trim()) return;
    saveReport({
      execId:  exec!.id,
      name:    exec!.name,
      company: exec!.company,
      field:   reportField,
      desc:    reportDesc.trim(),
      ts:      new Date().toISOString(),
    });
    setReportDone(true);
    setReportDesc("");
    setTimeout(() => { setShowReport(false); setReportDone(false); }, 1800);
  }

  const execMap = new Map(allExecs.map((e) => [e.id, e]));

  // 直接关联
  const connections: Array<{ exec: Executive; type: RelType; label: string }> = [];
  for (const link of allLinks) {
    const sid = typeof link.source === "object" ? link.source.id : (link.source as number);
    const tid = typeof link.target === "object" ? link.target.id : (link.target as number);
    let otherId: number | null = null;
    if (sid === exec.id) otherId = tid;
    else if (tid === exec.id) otherId = sid;
    if (otherId !== null) {
      const other = execMap.get(otherId);
      if (other) connections.push({ exec: other, type: link.type, label: link.label });
    }
  }
  const grouped: Partial<Record<RelType, typeof connections>> = {};
  for (const c of connections) {
    if (!grouped[c.type]) grouped[c.type] = [];
    grouped[c.type]!.push(c);
  }

  const regionColors: Record<string, string> = {
    CN: "bg-blue-500",
    HK: "bg-green-500",
    SG: "bg-orange-500",
  };

  // 职业轨迹
  const careerPath = exec.career_path ?? [];
  const MAX_CAREER = 6;
  const visibleCareer = careerExpanded ? careerPath : careerPath.slice(0, MAX_CAREER);
  const hasMoreCareer = careerPath.length > MAX_CAREER;

  // 原子字段
  const identity      = exec.identity;
  const education     = exec.education ?? [];
  const qualifications = exec.qualifications ?? [];
  const boardRoles    = exec.board_roles ?? [];
  const industryRoles = exec.industry_roles ?? [];
  const regulatorBg   = exec.extracted.regulator_bg ?? [];

  const genderLabel = identity?.gender === "M" ? "男" : identity?.gender === "F" ? "女" : null;

  return (
    <div className="flex flex-col h-full bg-slate-800 text-slate-100 border-l border-slate-700 overflow-hidden">

      {/* ── Header ── */}
      <div className="border-b border-slate-700">
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${regionColors[exec.region] || "bg-gray-500"}`} />
              <h2 className="text-lg font-bold truncate">{exec.name}</h2>
            </div>
            <p className="text-sm text-slate-400 leading-snug">{exec.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {exec.website ? (
                <a href={exec.website} target="_blank" rel="noreferrer" className="hover:text-blue-400 underline">
                  {exec.company}
                </a>
              ) : exec.company}
            </p>
          </div>
          <button onClick={onClose} className="ml-2 text-slate-500 hover:text-white text-lg leading-none flex-shrink-0">✕</button>
        </div>

        {/* 操作按钮行 */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={toggleKnown}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              isKnown
                ? "bg-pink-900/60 border-pink-600 text-pink-300"
                : "border-slate-600 text-slate-400 hover:border-pink-600 hover:text-pink-300"
            }`}
          >
            <span>{isKnown ? "❤️" : "🤝"}</span>
            <span>{isKnown ? "已标记认识" : "我认识TA"}</span>
          </button>
          <button
            onClick={() => { setShowReport(!showReport); setReportDone(false); }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showReport
                ? "bg-amber-900/60 border-amber-600 text-amber-300"
                : "border-slate-600 text-slate-400 hover:border-amber-600 hover:text-amber-300"
            }`}
          >
            <span>⚑</span>
            <span>报错</span>
          </button>
        </div>

        {/* 报错表单（内联展开） */}
        {showReport && (
          <div className="mx-4 mb-3 p-3 bg-slate-900/60 rounded-lg border border-amber-800/40">
            {reportDone ? (
              <p className="text-xs text-emerald-400 text-center py-1">✓ 已记录，感谢反馈</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400 flex-shrink-0">错误字段</span>
                  <select
                    value={reportField}
                    onChange={e => setReportField(e.target.value)}
                    className="flex-1 text-xs bg-slate-800 border border-slate-600 text-slate-300 rounded px-2 py-1"
                  >
                    {["姓名","职位","公司","教育背景","职业轨迹","专业资格","兼任职务","出生年份","性别","其他"].map(f => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  ref={reportRef}
                  value={reportDesc}
                  onChange={e => setReportDesc(e.target.value)}
                  placeholder="请描述错误内容（如：职位应为副总裁，不是总裁）"
                  rows={3}
                  className="w-full text-xs bg-slate-800 border border-slate-600 text-slate-300 rounded px-2 py-1.5 resize-none placeholder-slate-600 focus:outline-none focus:border-amber-600"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowReport(false)} className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1">取消</button>
                  <button
                    onClick={submitReport}
                    disabled={!reportDesc.trim()}
                    className="text-xs px-3 py-1 rounded bg-amber-700 text-amber-100 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    提交
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── 基本信息 chips ── */}
        {(identity?.birth_year || genderLabel) && (
          <div className="flex flex-wrap gap-1.5">
            {genderLabel && (
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{genderLabel}</span>
            )}
            {identity?.birth_year && (
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {identity.birth_year} 年生
              </span>
            )}
          </div>
        )}

        {/* ── 教育背景 ── */}
        {education.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">教育背景</h3>
            <div className="space-y-1">
              {education.map((edu, i) => (
                <div key={i} className="flex items-start gap-1.5 text-sm">
                  <span className="text-slate-500 mt-0.5 flex-shrink-0">🎓</span>
                  <span className="text-slate-300 leading-snug">
                    {edu.school && <span className="font-medium">{edu.school}</span>}
                    {edu.degree && <span className="text-slate-400"> · {edu.degree}</span>}
                    {edu.major  && <span className="text-slate-500"> · {edu.major}</span>}
                    {edu.year   && <span className="text-slate-600"> ({edu.year})</span>}
                    {!edu.school && !edu.major && edu.degree && (
                      <span className="text-slate-400">{edu.degree}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 专业资格 ── */}
        {qualifications.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">专业资格</h3>
            <div className="flex flex-wrap gap-1">
              {qualifications.map((q, i) => (
                <span key={i} className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded-full">{q}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── 职业轨迹 ── */}
        {careerPath.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">职业轨迹</h3>
            <div className="relative pl-4">
              {visibleCareer.map((step, idx) => {
                const yearStr = step.start_year
                  ? step.end_year
                    ? `${step.start_year}—${step.end_year}`
                    : step.is_current ? `${step.start_year}—今` : `${step.start_year}—`
                  : step.is_current ? "至今" : null;
                return (
                  <div key={idx} className="relative mb-3 last:mb-0">
                    {idx < visibleCareer.length - 1 && (
                      <div className="absolute left-[-9px] top-3 bottom-[-12px] w-px bg-slate-600" />
                    )}
                    <div className={`absolute left-[-13px] top-1.5 w-2 h-2 rounded-full border-2 ${
                      step.is_current ? "bg-blue-400 border-blue-300" : "bg-slate-600 border-slate-500"
                    }`} />
                    <div>
                      <button
                        onClick={() => onCompanyClick?.(step.company)}
                        className={`text-sm font-medium leading-tight text-left hover:underline ${
                          step.is_current ? "text-blue-300" : "text-slate-300 hover:text-slate-100"
                        }`}
                      >
                        {step.company}
                      </button>
                      {step.title && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{step.title}</p>
                      )}
                      {yearStr && (
                        <p className="text-xs text-slate-600 mt-0.5">{yearStr}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMoreCareer && (
              <button
                onClick={() => setCareerExpanded(!careerExpanded)}
                className="mt-1 text-xs text-slate-500 hover:text-slate-300"
              >
                {careerExpanded ? "收起" : `展开另 ${careerPath.length - MAX_CAREER} 条记录`}
              </button>
            )}
          </section>
        )}

        {/* ── 兼任职务 ── */}
        {boardRoles.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">兼任职务</h3>
            <div className="space-y-1">
              {boardRoles.map((br, i) => (
                <div key={i} className="flex items-start gap-1.5 text-sm">
                  <span className="text-slate-500 mt-0.5 flex-shrink-0">🏢</span>
                  <span className="text-slate-300 leading-snug">
                    <span className="font-medium">{br.company}</span>
                    {br.role && <span className="text-slate-400"> · {br.role}</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 行业职务 ── */}
        {industryRoles.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">行业职务</h3>
            <ul className="space-y-0.5">
              {industryRoles.map((r, i) => (
                <li key={i} className="text-xs text-slate-400 leading-snug">· {r}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── 监管背景 ── */}
        {regulatorBg.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">监管机构背景</h3>
            <div className="flex flex-wrap gap-1">
              {regulatorBg.map((r) => (
                <span key={r} className="text-xs bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full">{r}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── 简介 ── */}
        {exec.bio && (
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">原始简介</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{exec.bio}</p>
          </section>
        )}

        {/* ── 关联人脉 ── */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            关联人脉 ({connections.length})
          </h3>
          {connections.length === 0 ? (
            <p className="text-xs text-slate-500">暂无关联</p>
          ) : (
            <div className="space-y-3">
              {(["colleague", "alumni", "former", "regulator", "successor"] as RelType[]).map((type) => {
                const group = grouped[type];
                if (!group || group.length === 0) return null;
                return (
                  <div key={type}>
                    <div
                      className="text-xs font-medium mb-1 px-2 py-0.5 rounded inline-block"
                      style={{ background: REL_COLOR[type] + "33", color: REL_COLOR[type] }}
                    >
                      {REL_LABEL[type]}（{group.length}）
                    </div>
                    <ul className="space-y-1">
                      {group.slice(0, 8).map(({ exec: other, label }) => (
                        <li key={other.id}>
                          <button
                            onClick={() => onSelectNode(other)}
                            className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700 transition-colors group"
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: REGION_COLOR[other.region] }} />
                            <span className="font-medium text-sm group-hover:text-white">{other.name}</span>
                            <span className="text-xs text-slate-500 truncate ml-auto">{label}</span>
                          </button>
                        </li>
                      ))}
                      {group.length > 8 && (
                        <li className="text-xs text-slate-500 px-2">…另 {group.length - 8} 人</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
