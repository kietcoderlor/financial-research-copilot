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
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-zinc-800">Filters</h2>

      <label className="mb-1 block text-xs font-medium text-zinc-600">Companies</label>
      <select
        multiple
        value={value.companies}
        onChange={(event) => {
          const companies = Array.from(event.target.selectedOptions).map((item) => item.value);
          onChange({ ...value, companies });
        }}
        className="h-24 w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm"
      >
        {COMPANIES.map((company) => (
          <option key={company} value={company}>
            {company}
          </option>
        ))}
      </select>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Year min</label>
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
            className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Year max</label>
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
            className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <span className="block text-xs font-medium text-zinc-600">Doc types</span>
        {DOC_TYPES.map((docType) => {
          const checked = value.doc_types.includes(docType);
          return (
            <label key={docType} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const doc_types = checked
                    ? value.doc_types.filter((item) => item !== docType)
                    : [...value.doc_types, docType];
                  onChange({ ...value, doc_types });
                }}
              />
              {docType}
            </label>
          );
        })}
      </div>
    </section>
  );
}
