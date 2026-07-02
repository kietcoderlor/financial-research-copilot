import type { RetrieveFilters } from "@/lib/apiClient";

const FILTERS_KEY = "frc-filters";
const RECENT_KEY = "frc-recent-queries";
const ONBOARDING_KEY = "frc-onboarding-done";

export function loadFilters(): RetrieveFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RetrieveFilters;
  } catch {
    return null;
  }
}

export function saveFilters(filters: RetrieveFilters): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
}

export function loadRecentQueries(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentQuery(question: string): string[] {
  if (typeof window === "undefined") return [];
  const trimmed = question.trim();
  if (!trimmed) return loadRecentQueries();
  const next = [trimmed, ...loadRecentQueries().filter((q) => q !== trimmed)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function isOnboardingDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function markOnboardingDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_KEY, "1");
}
