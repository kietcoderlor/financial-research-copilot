"use client";

import type { RetrieveFilters } from "@/lib/apiClient";

type FilterPanelProps = {
  value: RetrieveFilters;
  onChange: (next: RetrieveFilters) => void;
};

const COMPANIES = ["AAPL", "BRK.A", "BRK.B"];
const DOC_TYPES = ["10-K", "10-Q", "transcript", "letter"];

export function FilterPanel({ value, onChange }: FilterPanelProps) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-950/5">
      <h2 className="mb-3 text-sm font-semibold text-stone-900">Filters</h2>

      <fieldset className="mb-4">
        <legend className="mb-2 block text-xs font-medium text-stone-700">Companies</legend>
        <p className="mb-2 text-xs leading-relaxed text-stone-600">
          Tick one or more tickers, or leave all unchecked to search the full corpus.
        </p>
        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
          {COMPANIES.map((ticker) => {
            const checked = value.companies.includes(ticker);
            return (
              <label
                key={ticker}
                className="flex cursor-pointer items-center gap-3 text-sm font-medium text-stone-900"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const companies = checked
                      ? value.companies.filter((c) => c !== ticker)
                      : [...value.companies, ticker];
                    onChange({ ...value, companies });
                  }}
                  className="size-4 rounded border-stone-400 text-teal-700 focus:ring-2 focus:ring-teal-600/30"
                />
                <span>{ticker}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-700">Year min</label>
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
            className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-700">Year max</label>
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
            className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/40"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <span className="block text-xs font-medium text-stone-700">Doc types</span>
        {DOC_TYPES.map((docType) => {
          const checked = value.doc_types.includes(docType);
          return (
            <label key={docType} className="flex cursor-pointer items-center gap-3 text-sm text-stone-900">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const doc_types = checked
                    ? value.doc_types.filter((item) => item !== docType)
                    : [...value.doc_types, docType];
                  onChange({ ...value, doc_types });
                }}
                className="size-4 rounded border-stone-400 text-teal-700 focus:ring-2 focus:ring-teal-600/30"
              />
              {docType}
            </label>
          );
        })}
      </div>
    </section>
  );
}
