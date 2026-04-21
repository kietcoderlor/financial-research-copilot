"use client";

import { useState } from "react";

import type { QueryCitation } from "@/lib/apiClient";

type CitationPanelProps = {
  citations: QueryCitation[];
};

export function CitationPanel({ citations }: CitationPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm ring-1 ring-stone-950/5">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-stone-900">Citations</h2>
      {citations.length === 0 ? (
        <p className="text-sm leading-relaxed text-stone-700">
          Source excerpts from the retrieval step will appear here after you run a query.
        </p>
      ) : (
        <div className="space-y-3">
          {citations.map((citation) => {
            const key = citation.chunk_id;
            const isOpen = Boolean(expanded[key]);
            return (
              <button
                type="button"
                key={key}
                onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                className="w-full rounded-lg border border-stone-200 bg-stone-50/50 p-3 text-left transition hover:border-stone-300 hover:bg-white"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-teal-800 px-2 py-0.5 font-semibold text-white">
                    {citation.company}
                  </span>
                  <span className="font-medium text-stone-800">
                    {citation.doc_type} {citation.year ?? ""}
                  </span>
                  <span className="text-stone-600">{citation.section ?? "—"}</span>
                </div>
                <p className="text-left text-sm leading-relaxed text-stone-800">
                  {isOpen ? citation.excerpt : `${citation.excerpt.slice(0, 180)}…`}
                </p>
                <span className="mt-1 block text-xs font-medium text-teal-800">
                  {isOpen ? "Show less" : "Tap to expand excerpt"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
