"use client";

import { useEffect, useRef } from "react";
import type { Company, Executive } from "@/lib/types";
import { REGION_COLOR } from "@/lib/types";

interface Props {
  companyName: string | null;
  companies: Company[];
  executives: Executive[];
  onClose: () => void;
  onSelectExec: (exec: Executive) => void;
}

export default function CompanyModal({ companyName, companies, executives, onClose, onSelectExec }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!companyName) return null;

  const company = companies.find((c) => c.name === companyName);
  const companyExecs = executives.filter((e) => e.company === companyName);

  const regionLabel: Record<string, string> = {
    CN: "中国大陆",
    HK: "中国香港",
    SG: "新加坡",
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-700 gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-100 leading-snug">
              {companyName}
            </h2>
            {company && (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: REGION_COLOR[company.region] || "#888" }}
                />
                <span className="text-xs text-slate-400">{regionLabel[company.region] || company.region}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-lg leading-none flex-shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* website */}
          {company?.website && (
            <div>
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 underline break-all"
              >
                {company.website}
              </a>
            </div>
          )}

          {/* intro */}
          {company?.intro ? (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">公司简介</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{company.intro}</p>
            </section>
          ) : (
            <p className="text-sm text-slate-500 italic">暂无公司简介</p>
          )}

          {/* executives in this company */}
          {companyExecs.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                本公司高管（{companyExecs.length} 人）
              </h3>
              <div className="flex flex-wrap gap-2">
                {companyExecs.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      onClose();
                      onSelectExec(e);
                    }}
                    className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-left"
                  >
                    <span className="font-medium">{e.name}</span>
                    {e.title && (
                      <span className="text-slate-500 ml-1">·{e.title.split("、")[0].slice(0, 10)}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
