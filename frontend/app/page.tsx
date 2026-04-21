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
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-200/80">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 border-l-4 border-teal-700 pl-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Research workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">Financial Research Copilot</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-700">
            Query SEC filings and transcripts with retrieval-backed answers. Every factual line should trace to a cited
            chunk.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <QueryInput value={question} loading={loading} onChange={setQuestion} onSubmit={runQuery} />
            <FilterPanel value={filters} onChange={setFilters} />
          </aside>

          <section className="space-y-4">
            <ErrorBanner error={error} onRetry={runQuery} />
            {noResults ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm font-medium leading-relaxed text-amber-950 shadow-sm ring-1 ring-amber-900/10">
                No citations returned for this run. Try broader filters or a different question.
              </div>
            ) : null}
            <AnswerDisplay answer={response?.answer ?? null} loading={loading} />
            <CitationPanel citations={response?.citations ?? []} />
          </section>
        </div>

        <footer className="mt-12 border-t border-stone-300/80 pt-6 text-xs leading-relaxed text-stone-700">
          Answers are grounded in ingested SEC filings, earnings transcripts, and company reports. Claims should align
          with the cited excerpts—verify material facts in the original filings.
        </footer>
      </main>
    </div>
  );
}
