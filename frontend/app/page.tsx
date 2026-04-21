"use client";

import { useMemo, useState } from "react";

import { AnswerDisplay } from "@/components/AnswerDisplay";
import { CitationPanel } from "@/components/CitationPanel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FilterPanel } from "@/components/FilterPanel";
import { QueryInput } from "@/components/QueryInput";
import { apiClient, type QueryResponse, type RetrieveFilters } from "@/lib/apiClient";

function defaultFilters(): RetrieveFilters {
  return { companies: [], years: [], doc_types: [] };
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [filters, setFilters] = useState<RetrieveFilters>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const noResults = useMemo(
    () => Boolean(response && response.answer && response.citations.length === 0),
    [response],
  );

  async function runQuery() {
    if (question.trim().length === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.query({
        question: question.trim(),
        filters,
      });
      setResponse(result);
      if (process.env.NODE_ENV !== "production") {
        console.log("query_payload", { question, filters });
        console.log("query_response", result);
      }
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : "Unexpected error.";
      const lower = message.toLowerCase();
      if (message.includes("429") || lower.includes("too many requests")) {
        setError("Rate limit exceeded. Please wait a minute and retry.");
      } else if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
        setError("Cannot reach API right now. Please retry shortly.");
      } else if (message === "Unexpected error.") {
        setError("Something went wrong. Please retry.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="hidden h-9 w-9 rounded-lg bg-teal-500/20 ring-1 ring-teal-400/40 sm:block" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-200/90">Workspace</p>
              <p className="text-sm font-semibold text-white">Financial Research Copilot</p>
            </div>
          </div>
          <p className="hidden max-w-md text-right text-xs leading-relaxed text-slate-300 sm:block">
            Retrieval-grounded Q&amp;A over ingested filings. Citations map to stored chunks.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="overflow-hidden rounded-2xl border border-black/20 bg-[#f4f1eb] shadow-2xl shadow-black/40 ring-1 ring-white/10">
          <div className="border-b border-stone-300/80 bg-[#ece7df] px-5 py-4 sm:px-8">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Research query
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-700">
              Build a question, narrow optional filters, then run the pipeline. Answers should cite the numbered
              sources below.
            </p>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(280px,360px)_1fr]">
            <aside className="border-b border-stone-300/80 bg-[#f7f4ef] p-4 sm:p-5 lg:border-b-0 lg:border-r lg:border-stone-300/80">
              <div className="space-y-4 lg:sticky lg:top-5">
                <QueryInput value={question} loading={loading} onChange={setQuestion} onSubmit={runQuery} />
                <FilterPanel value={filters} onChange={setFilters} />
              </div>
            </aside>

            <section className="space-y-4 bg-[#faf8f4] p-4 sm:p-6">
              <ErrorBanner error={error} onRetry={runQuery} />
              {noResults ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/95 p-4 text-sm font-medium leading-relaxed text-amber-950 shadow-sm ring-1 ring-amber-900/10">
                  No citations returned for this run. Try broader filters or a different question.
                </div>
              ) : null}
              <AnswerDisplay answer={response?.answer ?? null} loading={loading} />
              <CitationPanel citations={response?.citations ?? []} />
            </section>
          </div>

          <footer className="border-t border-stone-300/80 bg-[#ece7df] px-5 py-4 text-xs leading-relaxed text-stone-700 sm:px-8">
            Production use: verify figures and legal claims in the original SEC filings. This UI is a research aid, not
            investment advice.
          </footer>
        </div>
      </div>
    </div>
  );
}
