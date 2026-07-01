"use client";

import type { QueryMetadata } from "@/lib/apiClient";

type MetricsBarProps = {
  metadata: QueryMetadata | null;
};

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatCost(usd: number): string {
  if (usd <= 0) return "—";
  return usd < 0.01 ? `<$0.01` : `$${usd.toFixed(3)}`;
}

export function MetricsBar({ metadata }: MetricsBarProps) {
  if (!metadata) return null;

  const items = [
    { label: "Retrieval", value: formatMs(metadata.retrieval_ms) },
    { label: "Generation", value: formatMs(metadata.llm_ms) },
    { label: "Total", value: formatMs(metadata.total_ms) },
    { label: "Chunks", value: String(metadata.chunks_used) },
    { label: "Type", value: metadata.query_type },
    { label: "LLM cost", value: formatCost(metadata.llm_cost_usd) },
    {
      label: "Cache",
      value: metadata.semantic_cache_hit ? "semantic" : metadata.cache_hit ? "hit" : "miss",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</span>
          <span className="font-mono text-xs font-medium text-emerald-300">{item.value}</span>
        </div>
      ))}
      {metadata.hallucination_flags && metadata.hallucination_flags.length > 0 ? (
        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Flags</span>
          <span className="text-xs font-medium text-amber-200">{metadata.hallucination_flags.length}</span>
        </div>
      ) : null}
    </div>
  );
}
