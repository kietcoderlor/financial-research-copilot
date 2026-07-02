"use client";

import type { HistoryEntry } from "@/lib/queryHistory";

type QueryHistoryPanelProps = {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
};

export function QueryHistoryPanel({ entries, onSelect, onClear }: QueryHistoryPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">History</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">Recent queries will appear here.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">History</p>
        <button type="button" onClick={onClear} className="text-[10px] font-medium text-[var(--text-muted)] hover:text-rose-400">
          Clear
        </button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {entries.slice(0, 8).map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              <span className="line-clamp-2">{entry.question}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
