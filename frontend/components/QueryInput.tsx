"use client";

import { forwardRef } from "react";

type QueryInputProps = {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  compact?: boolean;
  recentQueries?: string[];
};

const EXAMPLES = [
  "Tesla risk factors 2024",
  "Compare Apple and Microsoft cloud growth",
  "Goldman Sachs risk factors",
];

export const QueryInput = forwardRef<HTMLTextAreaElement, QueryInputProps>(function QueryInput(
  { value, loading, onChange, onSubmit, compact = false, recentQueries = [] },
  ref,
) {
  return (
    <section className={compact ? "" : "panel p-5"} data-onboarding="query">
      {!compact ? <label className="section-kicker mb-3 block">Research question</label> : null}
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !loading) {
            event.preventDefault();
            onSubmit();
          }
          if (event.ctrlKey && event.key === "Enter" && !loading) {
            event.preventDefault();
            onSubmit();
          }
        }}
        rows={compact ? 3 : 4}
        placeholder="e.g. What are Tesla's margin drivers in Q2 2024?"
        className="input-field resize-none px-4 py-3 text-sm leading-relaxed placeholder:text-[var(--text-muted)]"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>Enter · ⌘K focus</span>
        <span className="font-mono">{value.length}</span>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || value.trim().length === 0}
        className="btn-primary mt-3 flex w-full gap-2 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {loading ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-[var(--btn-on-accent)]/30 border-t-[var(--btn-on-accent)]" />
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

      {!compact && recentQueries.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {recentQueries.slice(0, 3).map((example) => (
            <button
              type="button"
              key={example}
              onClick={() => onChange(example)}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              type="button"
              key={example}
              onClick={() => onChange(example)}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
});
