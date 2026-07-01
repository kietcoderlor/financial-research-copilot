"use client";

import { useEffect, useState } from "react";

import type { RetrieveFilters } from "@/lib/apiClient";

type FilterPanelProps = {
  value: RetrieveFilters;
  onChange: (next: RetrieveFilters) => void;
};

const DOC_TYPES = ["10-K", "10-Q", "transcript", "letter"];

export function FilterPanel({ value, onChange }: FilterPanelProps) {
  const [tickers, setTickers] = useState<string[] | null>(null);
  const [open, setOpen] = useState(true);

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
          <span className="text-slate-500">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open ? (
        <div className="border-t border-[var(--border-subtle)] px-5 pb-5 pt-4">
          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-medium text-slate-400">Companies</legend>
            {tickers === null ? (
              <p className="text-xs text-slate-500">Loading corpus…</p>
            ) : tickers.length === 0 ? (
              <p className="text-xs text-slate-500">No tickers ingested yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tickers.map((ticker) => {
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
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                      }`}
                    >
                      {ticker}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Year from</label>
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
                className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Year to</label>
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
                className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Document types</span>
            <button
              type="button"
              onClick={() => onChange({ companies: [], years: [], doc_types: [] })}
              className="text-xs font-medium text-emerald-400/80 hover:text-emerald-300"
            >
              Reset
            </button>
          </div>
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
                      : "border-white/10 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {docType}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
