"use client";

import { useEffect, useMemo, useState } from "react";

import type { RetrieveFilters } from "@/lib/apiClient";

type FilterPanelProps = {
  value: RetrieveFilters;
  onChange: (next: RetrieveFilters) => void;
};

const DOC_TYPES = ["10-K", "10-Q", "transcript", "letter"];

export function FilterPanel({ value, onChange }: FilterPanelProps) {
  const [tickers, setTickers] = useState<string[] | null>(null);
  const [open, setOpen] = useState(true);
  const [companySearch, setCompanySearch] = useState("");

  const filteredTickers = useMemo(() => {
    if (!tickers) return [];
    const q = companySearch.trim().toLowerCase();
    if (!q) return tickers;
    return tickers.filter((t) => t.toLowerCase().includes(q));
  }, [tickers, companySearch]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/meta/companies", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        setTickers(data.filter((x): x is string => typeof x === "string").sort());
      })
      .catch(() => {
        if (!cancelled) setTickers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tickers === null) return;
    if (tickers.length === 0) {
      if (value.companies.length > 0) onChange({ ...value, companies: [] });
      return;
    }
    const valid = value.companies.filter((c) => tickers.includes(c));
    if (valid.length !== value.companies.length) {
      onChange({ ...value, companies: valid });
    }
  }, [tickers, value, onChange]);

  const activeCount =
    value.companies.length + value.doc_types.length + (value.years.length > 0 ? 1 : 0);

  return (
    <section className="glass-panel rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Scope</p>
          <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">Corpus filters</p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              {activeCount} active
            </span>
          ) : null}
          <span className="text-[var(--text-muted)]">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open ? (
        <div className="border-t border-[var(--border-subtle)] px-5 pb-5 pt-4 space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-[var(--text-muted)]">Year range</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-muted)]">From</label>
                <input
                  type="number"
                  value={value.years[0] ?? ""}
                  placeholder="2023"
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    const maxYear = value.years[1];
                    const minYear = raw ? Number.parseInt(raw, 10) : Number.NaN;
                    const years = Number.isFinite(minYear)
                      ? maxYear
                        ? [minYear, maxYear]
                        : [minYear]
                      : maxYear
                        ? [maxYear]
                        : [];
                    onChange({ ...value, years });
                  }}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-sm text-[var(--text-primary)] focus:border-emerald-500/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-muted)]">To</label>
                <input
                  type="number"
                  value={value.years[1] ?? ""}
                  placeholder="2024"
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    const minYear = value.years[0];
                    const maxYear = raw ? Number.parseInt(raw, 10) : Number.NaN;
                    const years = Number.isFinite(maxYear)
                      ? minYear
                        ? [minYear, maxYear]
                        : [maxYear]
                      : minYear
                        ? [minYear]
                        : [];
                    onChange({ ...value, years });
                  }}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-sm text-[var(--text-primary)] focus:border-emerald-500/40 focus:outline-none"
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-[var(--text-muted)]">Document types</legend>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((docType) => {
                const checked = value.doc_types.includes(docType);
                return (
                  <button
                    key={docType}
                    type="button"
                    onClick={() => {
                      const doc_types = checked
                        ? value.doc_types.filter((item) => item !== docType)
                        : [...value.doc_types, docType];
                      onChange({ ...value, doc_types });
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                      checked
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {docType}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">Companies</span>
              {value.companies.length > 0 ? (
                <span className="text-[10px] text-emerald-400">{value.companies.length} selected</span>
              ) : null}
            </div>
            {tickers === null ? (
              <p className="text-xs text-[var(--text-muted)]">Loading corpus…</p>
            ) : tickers.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No tickers ingested yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                    />
                  </svg>
                  <input
                    type="search"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Search ticker…"
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-2 pl-8 pr-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-emerald-500/40 focus:outline-none"
                  />
                  {companySearch ? (
                    <button
                      type="button"
                      onClick={() => setCompanySearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                <div className="sidebar-scroll max-h-40 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-2">
                  {filteredTickers.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-[var(--text-muted)]">No match for "{companySearch}"</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {filteredTickers.map((ticker) => {
                        const checked = value.companies.includes(ticker);
                        return (
                          <button
                            key={ticker}
                            type="button"
                            onClick={() => {
                              const companies = checked
                                ? value.companies.filter((c) => c !== ticker)
                                : [...value.companies, ticker];
                              onChange({ ...value, companies });
                            }}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                              checked
                                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                            }`}
                          >
                            {ticker}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {filteredTickers.length} of {tickers.length} tickers
                </p>
              </div>
            )}
          </fieldset>

          <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              onClick={() => onChange({ companies: [], years: [], doc_types: [] })}
              className="text-xs font-medium text-emerald-400/80 hover:text-emerald-300"
            >
              Reset all filters
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
