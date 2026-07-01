"use client";

type QueryInputProps = {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

const EXAMPLES = [
  "Tesla risk factors 2024",
  "Compare Apple and Microsoft cloud growth",
  "Goldman Sachs risk factors",
];

export function QueryInput({ value, loading, onChange, onSubmit }: QueryInputProps) {
  return (
    <section className="glass-panel rounded-2xl p-5">
      <label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Research question
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === "Enter" && !loading) {
            event.preventDefault();
            onSubmit();
          }
        }}
        rows={4}
        placeholder="e.g. What are Tesla's margin drivers in Q2 2024?"
        className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>Ctrl + Enter to run</span>
        <span className="font-mono">{value.length}</span>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || value.trim().length === 0}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none"
      >
        {loading ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Running pipeline…
          </>
        ) : (
          <>
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            Run research query
          </>
        )}
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            type="button"
            key={example}
            onClick={() => onChange(example)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-emerald-500/30 hover:text-[var(--text-primary)]"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
