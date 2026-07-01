"use client";

import { useState } from "react";

import type { QueryCitation } from "@/lib/apiClient";

const DOC_COLORS: Record<string, string> = {
  "10-K": "text-sky-300 border-sky-500/30 bg-sky-500/10",
  "10-Q": "text-violet-300 border-violet-500/30 bg-violet-500/10",
  transcript: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  letter: "text-rose-300 border-rose-500/30 bg-rose-500/10",
};

type CitationPanelProps = {
  citations: QueryCitation[];
};

export function CitationPanel({ citations }: CitationPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (citations.length === 0) {
    return null;
  }

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="mb-5 flex items-end justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Evidence</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Source excerpts</h2>
        </div>
        <span className="font-mono text-xs text-slate-500">{citations.length} chunks</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {citations.map((citation) => {
          const key = citation.chunk_id;
          const isOpen = Boolean(expanded[key]);
          const excerpt = citation.excerpt.trim();
          const preview = excerpt.length > 180 ? `${excerpt.slice(0, 180)}…` : excerpt;
          const docStyle = DOC_COLORS[citation.doc_type] ?? "text-slate-300 border-white/20 bg-white/5";

          return (
            <article
              key={key}
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-sm font-bold text-white shadow-lg shadow-emerald-900/30">
                  {citation.index}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">{citation.company}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${docStyle}`}>
                      {citation.doc_type}
                    </span>
                    {citation.year != null ? (
                      <span className="font-mono text-[10px] text-slate-500">{citation.year}</span>
                    ) : null}
                  </div>
                  {citation.section ? (
                    <p className="mt-1 text-[11px] text-slate-500">{citation.section}</p>
                  ) : null}
                </div>
              </div>

              <blockquote className="mt-3 border-l-2 border-emerald-500/50 pl-3 text-sm leading-relaxed text-slate-300">
                {isOpen ? excerpt : preview}
              </blockquote>

              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                className="mt-3 text-xs font-medium text-emerald-400/90 transition hover:text-emerald-300"
              >
                {isOpen ? "Collapse" : "Read full excerpt"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
