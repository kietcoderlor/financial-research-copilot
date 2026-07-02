"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnswerDisplay } from "@/components/AnswerDisplay";
import { CitationPanel } from "@/components/CitationPanel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FilterPanel } from "@/components/FilterPanel";
import { OnboardingTour } from "@/components/OnboardingTour";
import { PageFooter } from "@/components/layout/PageFooter";
import { MetricsBar } from "@/components/MetricsBar";
import { PipelineLoader } from "@/components/PipelineLoader";
import { QueryHistoryPanel } from "@/components/QueryHistoryPanel";
import { QueryInput } from "@/components/QueryInput";
import { SavedNotesPanel } from "@/components/SavedNotesPanel";
import { useToast } from "@/components/ui/Toast";
import { apiClient, type QueryResponse, type ResearchNote, type RetrieveFilters } from "@/lib/apiClient";
import { copyAnswerMarkdown } from "@/lib/exportMarkdown";
import { addHistoryEntry, clearQueryHistory, loadQueryHistory, type HistoryEntry } from "@/lib/queryHistory";
import { isOnboardingDone, loadFilters, loadRecentQueries, pushRecentQuery, saveFilters } from "@/lib/storage";

function defaultFilters(): RetrieveFilters {
  return { companies: [], years: [], doc_types: [] };
}

export default function WorkspacePage() {
  const { toast } = useToast();
  const queryRef = useRef<HTMLTextAreaElement>(null);

  const [question, setQuestion] = useState("");
  const [filters, setFilters] = useState<RetrieveFilters>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [phase, setPhase] = useState<"idle" | "retrieving" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedNotes, setSavedNotes] = useState<ResearchNote[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [instantAnswer, setInstantAnswer] = useState(false);
  const [queryComplete, setQueryComplete] = useState(false);

  useEffect(() => {
    const saved = loadFilters();
    if (saved) setFilters(saved);
    setRecentQueries(loadRecentQueries());
    setHistory(loadQueryHistory());
    setShowOnboarding(!isOnboardingDone());
    void apiClient
      .listNotes()
      .then(setSavedNotes)
      .catch(() => {
        /* optional for first load */
      });
  }, []);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  const showEmpty = !loading && !response && !error;
  const hasAnswer = Boolean(response?.answer);

  const noResults = useMemo(
    () =>
      Boolean(
        queryComplete && response && response.answer && response.citations.length === 0,
      ),
    [queryComplete, response],
  );

  const runQuery = useCallback(
    async (q?: string, filtersOverride?: RetrieveFilters) => {
      const text = (q ?? question).trim();
      if (text.length === 0) return;
      const nextFilters = filtersOverride ?? filters;
      if (q) setQuestion(q);
      setLoading(true);
      setStreaming(false);
      setPhase("retrieving");
      setError(null);
      setSelectedCitation(null);
      setSidebarOpen(false);
      setResponse(null);
      setInstantAnswer(false);
      setQueryComplete(false);

      let answerText = "";

      try {
        await apiClient.queryStream(
          { question: text, filters: nextFilters },
          {
            onPhase: (next) => setPhase(next),
            onToken: (token) => {
              answerText += token;
              setStreaming(true);
              setResponse((prev) =>
                prev
                  ? { ...prev, answer: answerText }
                  : {
                      answer: answerText,
                      citations: [],
                      metadata: {
                        query_type: "general",
                        chunks_retrieved: 0,
                        chunks_used: 0,
                        retrieval_ms: 0,
                        llm_ms: 0,
                        input_tokens: 0,
                        output_tokens: 0,
                        llm_cost_usd: 0,
                        total_ms: 0,
                        cache_hit: false,
                      },
                    },
              );
            },
            onDone: (payload) => {
              const finalResponse: QueryResponse = {
                answer: answerText,
                citations: payload.citations,
                metadata: {
                  query_type: payload.query_type,
                  chunks_retrieved: payload.citations.length,
                  chunks_used: payload.citations.length,
                  retrieval_ms: 0,
                  llm_ms: payload.total_ms,
                  input_tokens: 0,
                  output_tokens: 0,
                  llm_cost_usd: 0,
                  total_ms: payload.total_ms,
                  cache_hit: false,
                },
              };
              setResponse(finalResponse);
              setQueryComplete(true);
              setRecentQueries(pushRecentQuery(text));
              setHistory(
                addHistoryEntry({
                  question: text,
                  filters: nextFilters,
                  answer: finalResponse.answer,
                  citations: finalResponse.citations,
                  metadata: finalResponse.metadata,
                }),
              );
              toast("Query complete", "success");
            },
          },
        );
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : "Unexpected error.";
        const lower = message.toLowerCase();
        if (message.includes("429") || lower.includes("too many requests")) {
          setError("Rate limit exceeded. Please wait a minute and retry.");
        } else if (lower.includes("not authenticated") || message.includes("401")) {
          setError("Session expired. Please sign in again.");
        } else if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
          setError("Cannot reach API. Is the backend running on :8000?");
        } else {
          setError(message);
        }
        setResponse(null);
        setQueryComplete(false);
        toast(message, "error");
      } finally {
        setLoading(false);
        setStreaming(false);
        setPhase("idle");
      }
    },
    [filters, question, toast],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        queryRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSidebarOpen(false);
        setSelectedCitation(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function restoreHistory(entry: HistoryEntry) {
    setInstantAnswer(true);
    setQueryComplete(true);
    setQuestion(entry.question);
    setFilters(entry.filters);
    setResponse({
      answer: entry.answer,
      citations: entry.citations,
      metadata: entry.metadata ?? {
        query_type: "general",
        chunks_retrieved: entry.citations.length,
        chunks_used: entry.citations.length,
        retrieval_ms: 0,
        llm_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        llm_cost_usd: 0,
        total_ms: 0,
        cache_hit: false,
      },
    });
    setError(null);
    setSidebarOpen(false);
  }

  function openSavedNote(note: ResearchNote) {
    setInstantAnswer(true);
    setQueryComplete(true);
    setQuestion(note.question);
    let citations = [] as QueryResponse["citations"];
    try {
      const parsed = JSON.parse(note.citations_json) as QueryResponse["citations"];
      if (Array.isArray(parsed)) citations = parsed;
    } catch {
      citations = [];
    }
    setResponse({
      answer: note.answer,
      citations,
      metadata: {
        query_type: "saved_note",
        chunks_retrieved: citations.length,
        chunks_used: citations.length,
        retrieval_ms: 0,
        llm_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        llm_cost_usd: 0,
        total_ms: 0,
        cache_hit: false,
      },
    });
  }

  async function deleteSavedNote(id: string) {
    try {
      await apiClient.deleteNote(id);
      setSavedNotes((prev) => prev.filter((n) => n.id !== id));
      toast("Saved note deleted", "info");
    } catch {
      toast("Could not delete note", "error");
    }
  }

  async function saveCurrentNote() {
    if (!response?.answer || !question.trim()) return;
    try {
      const note = await apiClient.createNote({
        title: question.trim().slice(0, 90),
        question: question.trim(),
        answer: response.answer,
        citations_json: JSON.stringify(response.citations),
      });
      setSavedNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
      toast("Saved to notes", "success");
    } catch {
      toast("Could not save note", "error");
    }
  }

  async function handleExport() {
    if (!response?.answer) return;
    try {
      await copyAnswerMarkdown(response.answer, response.citations);
      toast("Copied markdown to clipboard", "success");
    } catch {
      toast("Could not copy to clipboard", "error");
    }
  }

  async function handleRegenerate() {
    if (!question.trim()) return;
    await runQuery();
  }

  async function handleBroadenAndRetry() {
    const cleared = defaultFilters();
    setFilters(cleared);
    await runQuery(question, cleared);
    toast("Filters cleared and query rerun", "info");
  }

  return (
    <div className="app-shell workspace-shell flex min-h-0 flex-col overflow-hidden">
      <OnboardingTour active={showOnboarding} onComplete={() => setShowOnboarding(false)} />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? (
          <button
            type="button"
            className="sidebar-backdrop md:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`app-sidebar fixed left-0 z-40 border-r transition-transform duration-200 md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
          style={{ top: "var(--header-h)", height: "calc(100vh - var(--header-h))" }}
        >
          <div className="sidebar-scroll h-full overflow-y-auto overflow-x-hidden px-4 py-4 pb-10">
            <div className="flex flex-col gap-4">
              <div className="glass-panel rounded-2xl p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Research query
                </p>
                <QueryInput
                  ref={queryRef}
                  value={question}
                  loading={loading}
                  onChange={setQuestion}
                  onSubmit={() => runQuery()}
                  compact
                  recentQueries={recentQueries}
                />
              </div>
              <div data-onboarding="filters">
                <FilterPanel value={filters} onChange={setFilters} />
              </div>
              <QueryHistoryPanel
                entries={history}
                onSelect={restoreHistory}
                onClear={() => {
                  clearQueryHistory();
                  setHistory([]);
                  toast("History cleared", "info");
                }}
              />
              <SavedNotesPanel notes={savedNotes} onOpen={openSavedNote} onDelete={(id) => void deleteSavedNote(id)} />
            </div>
          </div>
        </aside>

        <div className="app-main-with-sidebar app-grid-bg flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              Filters & query
            </button>
            <span className="text-xs text-[var(--text-muted)]">⌘K focus query</span>
          </div>

          <main className="workspace-main px-6 py-6">
            <div className="mx-auto max-w-4xl space-y-5">
              <ErrorBanner error={error} onRetry={() => runQuery()} />

              {showEmpty ? <EmptyState onSelect={(q) => runQuery(q)} /> : null}

              {loading && phase === "retrieving" && !streaming ? (
                <div className="ui-step-enter">
                  <PipelineLoader />
                </div>
              ) : null}

              {queryComplete && response?.metadata && hasAnswer ? (
                <div className="ui-step-enter">
                  <MetricsBar metadata={response.metadata} citationCount={response.citations.length} />
                </div>
              ) : null}

              {noResults ? (
                <div className="ui-step-enter rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-100">
                  <p>No citations returned. Try broadening filters or regenerate the answer.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleBroadenAndRetry()}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/25"
                    >
                      Broaden filters
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRegenerate()}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : null}

              {(hasAnswer || (loading && streaming)) && (
                <div className="ui-step-enter">
                  <AnswerDisplay
                    answer={response?.answer ?? null}
                    loading={loading && !streaming}
                    instant={instantAnswer}
                    onCitationClick={setSelectedCitation}
                    onExport={() => void handleExport()}
                  />
                  {queryComplete && response?.answer ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void saveCurrentNote()}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      >
                        Save note
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {!loading && response?.citations?.length ? (
                <div className="ui-step-enter">
                  <CitationPanel
                    citations={response.citations}
                    selectedIndex={selectedCitation}
                    onSelect={setSelectedCitation}
                    queryText={question}
                  />
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
