"use client";

import { useState } from "react";

import type { QueryCitation } from "@/lib/apiClient";

type CitationPanelProps = {
  citations: QueryCitation[];
};

export function CitationPanel({ citations }: CitationPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-zinc-900">Citations</h2>
      {citations.length === 0 ? (
        <p className="text-sm text-zinc-500">No citations yet.</p>
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
                className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-zinc-900 px-2 py-0.5 text-white">{citation.company}</span>
                  <span className="text-zinc-600">
                    {citation.doc_type} {citation.year ?? ""}
                  </span>
                  <span className="text-zinc-500">{citation.section ?? "unknown section"}</span>
                </div>
                <p className="text-sm text-zinc-700">
                  {isOpen ? citation.excerpt : `${citation.excerpt.slice(0, 180)}...`}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
