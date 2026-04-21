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
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">Financial Research Copilot</h1>
          <p className="text-sm text-zinc-600">
            Ask questions across SEC filings and transcripts with grounded citations.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <QueryInput value={question} loading={loading} onChange={setQuestion} onSubmit={runQuery} />
            <FilterPanel value={filters} onChange={setFilters} />
          </aside>

          <section className="space-y-4">
            <ErrorBanner error={error} onRetry={runQuery} />
            {noResults ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">
                No results found. Try broader filters or a simpler question.
              </div>
            ) : null}
            <AnswerDisplay answer={response?.answer ?? null} loading={loading} />
            <CitationPanel citations={response?.citations ?? []} />
          </section>
        </div>

        <footer className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
          Answers are grounded in SEC filings, earnings transcripts, and company reports. All claims are cited.
        </footer>
      </main>
    </div>
  );
}
