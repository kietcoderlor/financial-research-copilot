"use client";

import ReactMarkdown from "react-markdown";

import { AnswerSkeleton } from "@/components/ui/Skeleton";

type AnswerDisplayProps = {
  answer: string | null;
  loading: boolean;
  streaming?: boolean;
  onCitationClick?: (index: number) => void;
  onExport?: () => void;
};

function formatCitationRefs(text: string): string {
  return text.replace(/\[(\d+)\]/g, "**[$1]**");
}

export function AnswerDisplay({
  answer,
  loading,
  streaming = false,
  onCitationClick,
  onExport,
}: AnswerDisplayProps) {
  const showSkeleton = loading && !answer;
  const showAnswer = Boolean(answer);

  return (
    <section className="glass-panel rounded-2xl p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Synthesized answer
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Research brief</h2>
        </div>
        <div className="flex items-center gap-2">
          {showAnswer && !loading ? (
            <button type="button" onClick={onExport} className="btn-secondary px-3 py-1.5 text-xs">
              Copy markdown
            </button>
          ) : null}
          {showAnswer && !loading ? (
            <span className="chip-ticker border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              {streaming ? "Streaming…" : "Grounded"}
            </span>
          ) : null}
        </div>
      </div>

      {showSkeleton ? <AnswerSkeleton /> : null}

      {showAnswer ? (
        <div className="answer-markdown max-w-none">
          <ReactMarkdown
            components={{
              strong: ({ children }) => {
                const text = String(children);
                const match = /^\[(\d+)\]$/.exec(text);
                if (match && onCitationClick) {
                  const index = Number(match[1]);
                  return (
                    <button
                      type="button"
                      onClick={() => onCitationClick(index)}
                      className="citation-ref mx-0.5 inline-flex min-w-[1.4rem] items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
                      aria-label={`View source ${index}`}
                    >
                      {index}
                    </button>
                  );
                }
                return <strong>{children}</strong>;
              },
            }}
          >
            {formatCitationRefs(answer ?? "")}
          </ReactMarkdown>
          {streaming ? <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-emerald-400" /> : null}
        </div>
      ) : null}
    </section>
  );
}
