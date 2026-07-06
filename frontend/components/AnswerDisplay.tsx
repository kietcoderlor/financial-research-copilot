"use client";

import ReactMarkdown from "react-markdown";

import { AnswerSkeleton } from "@/components/ui/Skeleton";
import { useTypewriter } from "@/hooks/useTypewriter";
import { prepareStreamingMarkdown } from "@/lib/streamingMarkdown";

type AnswerDisplayProps = {
  answer: string | null;
  loading: boolean;
  instant?: boolean;
  onCitationClick?: (index: number) => void;
  onExport?: () => void;
};

function formatCitationRefs(text: string): string {
  return text.replace(/\[(\d+)\]/g, "**[$1]**");
}

export function AnswerDisplay({
  answer,
  loading,
  instant = false,
  onCitationClick,
  onExport,
}: AnswerDisplayProps) {
  const { displayed, isTyping } = useTypewriter(answer ?? "", {
    instant,
    frameIntervalMs: 18,
    profile: "chatgpt",
  });

  const showSkeleton = loading && !answer;
  const showAnswer = Boolean(answer);
  const rendered = isTyping
    ? prepareStreamingMarkdown(formatCitationRefs(displayed))
    : formatCitationRefs(displayed);

  return (
    <section className="panel p-6 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <p className="section-kicker">Synthesized answer</p>
          <h2 className="font-display mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Research brief</h2>
        </div>
        <div className="flex items-center gap-2">
          {showAnswer && !isTyping && !loading ? (
            <button type="button" onClick={onExport} className="btn-secondary px-3 py-1.5 text-xs">
              Copy markdown
            </button>
          ) : null}
          {showAnswer ? (
            <span className="chip-ticker border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)]">
              {isTyping ? "Typing…" : "Grounded"}
            </span>
          ) : null}
        </div>
      </div>

      {showSkeleton ? <AnswerSkeleton /> : null}

      {showAnswer ? (
        <div className={`answer-markdown max-w-none ${isTyping ? "answer-markdown-typing" : ""}`}>
          <div className="answer-markdown-body">
            <ReactMarkdown
              components={{
                strong: ({ children }) => {
                  const text = String(children);
                  const match = /^\[(\d+)\]$/.exec(text);
                  if (match && onCitationClick && !isTyping) {
                    const index = Number(match[1]);
                    return (
                      <button
                        type="button"
                        onClick={() => onCitationClick(index)}
                        className="citation-ref mx-0.5 inline-flex min-w-[1.4rem] items-center justify-center px-1 text-xs font-bold transition hover:text-[var(--accent-hover)]"
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
              {rendered}
            </ReactMarkdown>
          </div>
          {isTyping ? <span className="typewriter-cursor" aria-hidden /> : null}
        </div>
      ) : null}
    </section>
  );
}
