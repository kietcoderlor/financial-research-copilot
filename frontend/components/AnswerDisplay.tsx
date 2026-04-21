"use client";

import ReactMarkdown from "react-markdown";

type AnswerDisplayProps = {
  answer: string | null;
  loading: boolean;
};

export function AnswerDisplay({ answer, loading }: AnswerDisplayProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-zinc-900">Answer</h2>
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-11/12 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-10/12 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-8/12 animate-pulse rounded bg-zinc-200" />
        </div>
      ) : answer ? (
        <div className="prose prose-zinc max-w-none text-sm">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Submit a query to see a grounded answer.</p>
      )}
    </section>
  );
}
