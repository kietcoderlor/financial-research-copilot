import type { QueryCitation, QueryMetadata, RetrieveFilters } from "@/lib/apiClient";

export type HistoryEntry = {
  id: string;
  question: string;
  filters: RetrieveFilters;
  answer: string;
  citations: QueryCitation[];
  metadata: QueryMetadata | null;
  createdAt: string;
};

const HISTORY_KEY = "frc-query-history";
const MAX_ENTRIES = 25;

export function loadQueryHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueryHistory(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addHistoryEntry(entry: Omit<HistoryEntry, "id" | "createdAt">): HistoryEntry[] {
  const record: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const next = [record, ...loadQueryHistory().filter((e) => e.question !== record.question)].slice(0, MAX_ENTRIES);
  saveQueryHistory(next);
  return next;
}

export function clearQueryHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}
