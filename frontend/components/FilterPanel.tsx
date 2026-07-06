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
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);

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
    <section className="panel overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="section-kicker">Scope</p>
          <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">Corpus filters</p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
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
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-dim)]"
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
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-dim)]"
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
                        ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)]"
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
                <span className="text-[10px] text-[var(--text-muted)]">{value.companies.length} selected</span>
              ) : null}
            </div>
            {tickers === null ? (
              <p className="text-xs text-[var(--text-muted)]">Loading corpus…</p>
            ) : tickers.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No tickers ingested yet.</p>
            ) : (
              <div className="space-y-2">
                {value.companies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {value.companies.map((ticker) => (
                      <button
                        key={ticker}
                        type="button"
                        onClick={() => onChange({ ...value, companies: value.companies.filter((c) => c !== ticker) })}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--accent-border)] bg-[var(--accent-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]"
                      >
                        {ticker}
                        <span className="text-[10px] opacity-70">×</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {!companyPickerOpen ? (
                  <button
                    type="button"
                    onClick={() => setCompanyPickerOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-xs text-[var(--text-muted)] transition hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                  >
                    <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                    </svg>
                    Search ticker…
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-2">
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
                        autoFocus
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Type ticker symbol…"
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-2 pl-8 pr-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-dim)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCompanyPickerOpen(false);
                          setCompanySearch("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        aria-label="Close ticker search"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="sidebar-scroll max-h-40 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 p-2">
                      {companySearch.trim() === "" ? (
                        <p className="px-1 py-2 text-xs text-[var(--text-muted)]">Type to filter tickers…</p>
                      ) : filteredTickers.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-[var(--text-muted)]">No match for &ldquo;{companySearch}&rdquo;</p>
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
                                    ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)]"
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
                    {companySearch.trim() !== "" ? (
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {filteredTickers.length} of {tickers.length} tickers
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              onClick={() => onChange({ companies: [], years: [], doc_types: [] })}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Reset all filters
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
