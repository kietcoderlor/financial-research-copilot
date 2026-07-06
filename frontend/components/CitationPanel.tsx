"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { QueryCitation } from "@/lib/apiClient";

const DOC_COLORS: Record<string, string> = {
  "10-K": "text-[var(--text-primary)] border-[var(--border-strong)] bg-[var(--bg-elevated)]",
  "10-Q": "text-[var(--text-primary)] border-[var(--border-strong)] bg-[var(--bg-elevated)]",
  transcript: "text-[var(--text-primary)] border-[var(--border-strong)] bg-[var(--bg-elevated)]",
  letter: "text-[var(--text-primary)] border-[var(--border-strong)] bg-[var(--bg-elevated)]",
};

type CitationPanelProps = {
  citations: QueryCitation[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  queryText?: string;
};

function queryTerms(queryText: string): string[] {
  return Array.from(
    new Set(
      queryText
        .toLowerCase()
        .split(/\s+/)
        .map((x) => x.replace(/[^a-z0-9\-]/g, ""))
        .filter((x) => x.length >= 4),
    ),
  );
}

function highlightExcerpt(excerpt: string, terms: string[]): ReactNode {
  if (!terms.length) return excerpt;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "ig");
  const isTerm = new RegExp(`^(${escaped.join("|")})$`, "i");
  return excerpt.split(re).map((part, idx) =>
    isTerm.test(part) ? (
      <mark key={`${part}-${idx}`} className="rounded bg-[var(--accent-dim)] px-0.5 text-[var(--accent)]">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    ),
  );
}

export function CitationPanel({ citations, selectedIndex = null, onSelect, queryText = "" }: CitationPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});
  const terms = queryTerms(queryText);

  useEffect(() => {
    if (selectedIndex == null) return;
    const node = cardRefs.current[selectedIndex];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setExpanded((prev) => {
        const citation = citations.find((c) => c.index === selectedIndex);
        if (!citation) return prev;
        return { ...prev, [citation.chunk_id]: true };
      });
    }
  }, [selectedIndex, citations]);

  if (citations.length === 0) {
    return null;
  }
  const activeCitation = citations.find((c) => c.index === selectedIndex) ?? citations[0];

  return (
    <section className="panel overflow-hidden p-0" data-onboarding="results">
      <div className="mb-5 flex items-end justify-between gap-2 border-b border-[var(--border-subtle)] px-6 pt-6 pb-4">
        <div>
          <p className="section-kicker">Evidence</p>
          <h2 className="font-display mt-1 text-lg font-semibold text-[var(--text-primary)]">Source excerpts</h2>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">{citations.length} chunks</span>
      </div>

      <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
        {citations.map((citation) => {
          const key = citation.chunk_id;
          const isOpen = Boolean(expanded[key]);
          const excerpt = citation.excerpt.trim();
          const preview = excerpt.length > 180 ? `${excerpt.slice(0, 180)}…` : excerpt;
          const docStyle =
            DOC_COLORS[citation.doc_type] ??
            "text-[var(--text-primary)] border-[var(--border-strong)] bg-[var(--bg-elevated)]";
          const isSelected = selectedIndex === citation.index;

          return (
            <article
              key={key}
              ref={(node) => {
                cardRefs.current[citation.index] = node;
              }}
              onClick={() => onSelect?.(citation.index)}
              className={`group cursor-pointer rounded-md border bg-[var(--bg-surface)] p-4 transition hover:border-[var(--border-strong)] ${
                isSelected ? "border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]" : "border-[var(--border-subtle)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--accent-border)] bg-[var(--accent-dim)] font-mono text-sm font-semibold text-[var(--accent)]">
                  {citation.index}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{citation.company}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${docStyle}`}>
                      {citation.doc_type}
                    </span>
                    {citation.year != null ? (
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">{citation.year}</span>
                    ) : null}
                  </div>
                  {citation.section ? (
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{citation.section}</p>
                  ) : null}
                </div>
              </div>

              <blockquote className="mt-3 border-l-2 border-[var(--accent-border)] pl-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {isOpen ? highlightExcerpt(excerpt, terms) : highlightExcerpt(preview, terms)}
              </blockquote>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((prev) => ({ ...prev, [key]: !isOpen }));
                }}
                className="mt-3 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                {isOpen ? "Collapse" : "Read full excerpt"}
              </button>

              {citation.source_url ? (
                <a
                  href={citation.source_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-2 block text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                >
                  View filing →
                </a>
              ) : null}
            </article>
          );
        })}
      </div>

      {activeCitation ? (
        <div className="mx-6 mb-6 rounded-md border border-[var(--accent-border)] bg-[var(--accent-dim)] p-4">
          <p className="section-kicker text-[var(--accent)]">Source viewer</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-primary)]">{activeCitation.company}</span>
            <span>{activeCitation.doc_type}</span>
            {activeCitation.year != null ? <span>{activeCitation.year}</span> : null}
            {activeCitation.section ? <span>· {activeCitation.section}</span> : null}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
            {highlightExcerpt(activeCitation.excerpt.trim(), terms)}
          </p>
          {activeCitation.source_url ? (
            <a
              href={activeCitation.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
            >
              Open original filing →
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
