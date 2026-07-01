"use client";

import { useMemo, useState } from "react";

import { AnswerDisplay } from "@/components/AnswerDisplay";
import { CitationPanel } from "@/components/CitationPanel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FilterPanel } from "@/components/FilterPanel";
import { MetricsBar } from "@/components/MetricsBar";
import { PipelineLoader } from "@/components/PipelineLoader";
import { QueryInput } from "@/components/QueryInput";
import { ThemeToggle } from "@/components/ThemeToggle";
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

  const showEmpty = !loading && !response && !error;
  const hasAnswer = Boolean(response?.answer);

  const noResults = useMemo(
    () => Boolean(response && response.answer && response.citations.length === 0),
    [response],
  );

  async function runQuery(q?: string) {
    const text = (q ?? question).trim();
    if (text.length === 0) return;
    if (q) setQuestion(q);
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.query({ question: text, filters });
      setResponse(result);
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : "Unexpected error.";
      const lower = message.toLowerCase();
      if (message.includes("429") || lower.includes("too many requests")) {
        setError("Rate limit exceeded. Please wait a minute and retry.");
      } else if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
        setError("Cannot reach API. Is the backend running on :8000?");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell flex min-h-screen">
      {/* Fixed left sidebar */}
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-900/30">
              <span className="text-sm font-bold text-white">FR</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Research Copilot</p>
              <p className="truncate text-[10px] text-[var(--text-muted)]">SEC filings · transcripts</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <QueryInput
            value={question}
            loading={loading}
            onChange={setQuestion}
            onSubmit={() => runQuery()}
          />
          <FilterPanel value={filters} onChange={setFilters} />
        </div>
      </aside>

      {/* Main content */}
      <div className="app-grid-bg flex min-h-screen min-w-0 flex-1 flex-col pl-80">
        <header className="app-header sticky top-0 z-30 border-b backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div>
              <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                Financial Research Copilot
              </h1>
              <p className="text-[11px] text-[var(--text-muted)]">Hybrid RAG · grounded citations</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs text-[var(--text-muted)]">API connected</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-4xl space-y-5">
            <ErrorBanner error={error} onRetry={() => runQuery()} />

            {showEmpty ? <EmptyState onSelect={(q) => runQuery(q)} /> : null}

            {loading ? <PipelineLoader /> : null}

            {response?.metadata ? <MetricsBar metadata={response.metadata} /> : null}

            {noResults ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-100">
                No citations returned. Try clearing filters or broadening the question.
              </div>
            ) : null}

            {hasAnswer && !loading ? <AnswerDisplay answer={response?.answer ?? null} loading={false} /> : null}

            {!loading && response?.citations?.length ? (
              <CitationPanel citations={response.citations} />
            ) : null}
          </div>
        </main>

        <footer className="border-t border-[var(--border-subtle)] py-5 text-center text-[11px] text-[var(--text-muted)]">
          Research aid only — verify figures in original SEC filings. Not investment advice.
        </footer>
      </div>
    </div>
  );
}
