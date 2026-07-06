"use client";

import { useState } from "react";

import { Stagger } from "@/components/motion/Reveal";

const CATEGORIES = [
  {
    id: "single_company",
    label: "Single company",
    queries: [
      { query: "Tesla risk factors 2024", desc: "10-K risk factors with citations" },
      { query: "Apple services revenue growth drivers", desc: "Revenue mix from recent filings" },
    ],
  },
  {
    id: "comparison",
    label: "Comparison",
    queries: [
      { query: "Compare Apple and Microsoft cloud growth", desc: "Multi-hop retrieval across tickers" },
      { query: "NVIDIA vs AMD data center revenue trends", desc: "Cross-company synthesis" },
    ],
  },
  {
    id: "bull_bear",
    label: "Bull / bear",
    queries: [
      { query: "Bull and bear case for Tesla in 2024 filings", desc: "Balanced synthesis from transcripts" },
      { query: "Bull vs bear thesis for Meta advertising", desc: "Management commentary contrast" },
    ],
  },
  {
    id: "general",
    label: "General research",
    queries: [
      { query: "Goldman Sachs capital requirements and liquidity", desc: "Bank regulatory disclosures" },
      { query: "What did Amazon say about AWS margins?", desc: "Earnings transcript insights" },
    ],
  },
] as const;

type EmptyStateProps = {
  onSelect: (query: string) => void;
};

export function EmptyState({ onSelect }: EmptyStateProps) {
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]["id"]>(CATEGORIES[0].id);
  const category = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0];

  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center" data-onboarding="results">
      <div className="mb-5 flex size-12 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <svg className="size-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
          />
        </svg>
      </div>
      <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--text-primary)]">Ask your research question</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
        Grounded answers from SEC filings and earnings transcripts — every claim linked to a source chunk.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-1.5">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveCategory(item.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeCategory === item.id
                ? "bg-[var(--accent-dim)] text-[var(--accent)] ring-1 ring-[var(--accent-border)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        <Stagger start={1}>
          {category.queries.map((item) => (
            <button
              key={item.query}
              type="button"
              onClick={() => onSelect(item.query)}
              className="surface-card group p-4 text-left"
            >
              <p className="section-kicker">{category.label}</p>
              <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{item.query}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{item.desc}</p>
            </button>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
