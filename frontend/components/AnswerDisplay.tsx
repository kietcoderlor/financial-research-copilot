"use client";

import ReactMarkdown from "react-markdown";

type AnswerDisplayProps = {
  answer: string | null;
  loading: boolean;
};

export function AnswerDisplay({ answer, loading }: AnswerDisplayProps) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm ring-1 ring-stone-950/5">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-stone-900">Answer</h2>
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-11/12 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-10/12 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-8/12 animate-pulse rounded bg-stone-200" />
        </div>
      ) : answer ? (
        <div className="prose prose-stone max-w-none text-[15px] leading-relaxed prose-headings:text-stone-900 prose-p:text-stone-800 prose-li:text-stone-800 prose-strong:text-stone-900">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-stone-700">
          Submit a question to see an answer grounded in your ingested documents.
        </p>
      )}
    </section>
  );
}
