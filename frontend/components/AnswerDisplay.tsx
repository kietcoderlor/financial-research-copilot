"use client";

import ReactMarkdown from "react-markdown";

type AnswerDisplayProps = {
  answer: string | null;
  loading: boolean;
};

function formatCitationRefs(text: string): string {
  return text.replace(/\[(\d+)\]/g, "**[$1]**");
}

export function AnswerDisplay({ answer, loading }: AnswerDisplayProps) {
  return (
    <section className="glass-panel rounded-2xl p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Synthesized answer
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Research brief</h2>
        </div>
        {answer && !loading ? (
          <span className="chip-ticker border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Grounded</span>
        ) : null}
      </div>

      {loading ? null : answer ? (
        <div className="answer-markdown max-w-none">
          <ReactMarkdown>{formatCitationRefs(answer)}</ReactMarkdown>
        </div>
      ) : null}
    </section>
  );
}
