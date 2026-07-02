"use client";

import { useMemo, useState } from "react";

import { AnswerDisplay } from "@/components/AnswerDisplay";
import { CitationPanel } from "@/components/CitationPanel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FilterPanel } from "@/components/FilterPanel";
import { PageFooter } from "@/components/layout/PageFooter";
import { MetricsBar } from "@/components/MetricsBar";
import { Reveal } from "@/components/motion/Reveal";
import { PipelineLoader } from "@/components/PipelineLoader";
import { QueryInput } from "@/components/QueryInput";
import { apiClient, type QueryResponse, type RetrieveFilters } from "@/lib/apiClient";

function defaultFilters(): RetrieveFilters {
  return { companies: [], years: [], doc_types: [] };
}

export default function WorkspacePage() {
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
    <div className="app-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <aside
          className="app-sidebar fixed left-0 z-30 border-r"
          style={{ top: "var(--header-h)", height: "calc(100vh - var(--header-h))" }}
        >
          <div className="sidebar-scroll h-full overflow-y-auto overflow-x-hidden px-4 py-4 pb-10">
            <div className="flex flex-col gap-4">
              <div className="glass-panel rounded-2xl p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Research query
                </p>
                <QueryInput
                  value={question}
                  loading={loading}
                  onChange={setQuestion}
                  onSubmit={() => runQuery()}
                  compact
                />
              </div>
              <FilterPanel value={filters} onChange={setFilters} />
            </div>
          </div>
        </aside>

        <div className="app-main-with-sidebar app-grid-bg flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main className="sidebar-scroll flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-4xl space-y-5">
              <Reveal delay={2}>
                <ErrorBanner error={error} onRetry={() => runQuery()} />
              </Reveal>

              {showEmpty ? (
                <Reveal delay={3}>
                  <EmptyState onSelect={(q) => runQuery(q)} />
                </Reveal>
              ) : null}

              {loading ? (
                <div className="ui-step-enter">
                  <PipelineLoader />
                </div>
              ) : null}

              {response?.metadata ? (
                <div className="ui-step-enter">
                  <MetricsBar metadata={response.metadata} />
                </div>
              ) : null}

              {noResults ? (
                <div className="ui-step-enter rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-100">
                  No citations returned. Try clearing filters or broadening the question.
                </div>
              ) : null}

              {hasAnswer && !loading ? (
                <div className="ui-step-enter">
                  <AnswerDisplay answer={response?.answer ?? null} loading={false} />
                </div>
              ) : null}

              {!loading && response?.citations?.length ? (
                <div className="ui-step-enter">
                  <CitationPanel citations={response.citations} />
                </div>
              ) : null}
            </div>
          </main>

          <PageFooter />
        </div>
      </div>
    </div>
  );
}
