"use client";

import type { QueryMetadata } from "@/lib/apiClient";

type MetricsBarProps = {
  metadata: QueryMetadata | null;
  citationCount?: number;
};

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatCost(usd: number): string {
  if (usd <= 0) return "—";
  return usd < 0.01 ? `<$0.01` : `$${usd.toFixed(3)}`;
}

function confidenceFromSignals(metadata: QueryMetadata, citationCount: number): {
  label: "High" | "Medium" | "Low";
  tone: string;
} {
  const flagCount = metadata.hallucination_flags?.length ?? 0;
  if (flagCount > 0 || citationCount === 0) {
    return { label: "Low", tone: "text-rose-400/90" };
  }
  if (citationCount >= 3 && metadata.chunks_used >= 3) {
    return { label: "High", tone: "text-[var(--accent)]" };
  }
  return { label: "Medium", tone: "text-[var(--text-secondary)]" };
}

export function MetricsBar({ metadata, citationCount = 0 }: MetricsBarProps) {
  if (!metadata) return null;
  const confidence = confidenceFromSignals(metadata, citationCount);

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
    { label: "Confidence", value: confidence.label, tone: confidence.tone },
  ];

  return (
    <div className="metrics-strip">
      {items.map((item) => (
        <div key={item.label} className="metrics-strip-item">
          <span className="section-kicker">{item.label}</span>
          <span className={`font-mono text-xs font-medium ${item.tone ?? "text-[var(--text-primary)]"}`}>{item.value}</span>
        </div>
      ))}
      {metadata.hallucination_flags && metadata.hallucination_flags.length > 0 ? (
        <div className="metrics-strip-item border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span className="section-kicker">Flags</span>
          <span className="font-mono text-xs font-medium text-rose-400/90">{metadata.hallucination_flags.length}</span>
        </div>
      ) : null}
    </div>
  );
}
