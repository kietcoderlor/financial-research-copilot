"use client";

const STEPS = ["Embed query", "Hybrid retrieve", "Cohere rerank", "Claude synthesize"];

type PipelineLoaderProps = {
  active?: boolean;
};

export function PipelineLoader({ active = true }: PipelineLoaderProps) {
  if (!active) return null;

  return (
    <div className="glass-panel rounded-2xl p-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Pipeline running</p>
      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <span
              className="pipeline-dot size-2 rounded-full bg-emerald-400"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
            <span className="text-sm text-[var(--text-secondary)]">{step}</span>
            <span className="ml-auto font-mono text-[10px] text-[var(--text-muted)]">···</span>
          </div>
        ))}
      </div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500" />
      </div>
    </div>
  );
}
