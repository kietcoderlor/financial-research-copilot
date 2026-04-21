"use client";

import { useState } from "react";

import type { QueryCitation } from "@/lib/apiClient";

type CitationPanelProps = {
  citations: QueryCitation[];
};

export function CitationPanel({ citations }: CitationPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (citations.length === 0) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm ring-1 ring-stone-950/5">
        <h2 className="mb-2 text-base font-semibold tracking-tight text-stone-900">Sources</h2>
        <p className="text-sm leading-relaxed text-stone-700">
          Numbered excerpts from retrieved chunks will appear here after a successful query.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm ring-1 ring-stone-950/5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-stone-200 pb-3">
        <h2 className="text-base font-semibold tracking-tight text-stone-900">Sources</h2>
        <p className="text-xs text-stone-600">{citations.length} excerpt{citations.length === 1 ? "" : "s"}</p>
      </div>

      <ol className="list-none space-y-0 divide-y divide-stone-200">
        {citations.map((citation) => {
          const key = citation.chunk_id;
          const isOpen = Boolean(expanded[key]);
          const excerpt = citation.excerpt.trim();
          const preview = excerpt.length > 220 ? `${excerpt.slice(0, 220)}…` : excerpt;

          return (
            <li key={key} className="flex gap-0 py-4 first:pt-0">
              <div
                className="mr-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white shadow-inner"
                aria-hidden
              >
                {citation.index}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <span className="text-sm font-bold tracking-normal text-slate-900">{citation.company}</span>
                  <span className="text-stone-400" aria-hidden>
                    ·
                  </span>
                  <span>{citation.doc_type}</span>
                  {citation.year != null ? (
                    <>
                      <span className="text-stone-400" aria-hidden>
                        ·
                      </span>
                      <span>{citation.year}</span>
                    </>
                  ) : null}
                  {citation.section ? (
                    <>
                      <span className="text-stone-400" aria-hidden>
                        ·
                      </span>
                      <span className="font-medium normal-case text-stone-600">{citation.section}</span>
                    </>
                  ) : null}
                </div>

                <blockquote className="mt-2 border-l-[3px] border-teal-700 bg-stone-50/90 py-2 pl-3 pr-2 text-sm font-normal leading-relaxed text-stone-900">
                  {isOpen ? excerpt : preview}
                </blockquote>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                    className="text-xs font-semibold text-teal-800 underline-offset-2 hover:underline"
                  >
                    {isOpen ? "Show less" : "Expand excerpt"}
                  </button>
                  {citation.source_url ? (
                    <a
                      href={citation.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
                    >
                      Open source
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
