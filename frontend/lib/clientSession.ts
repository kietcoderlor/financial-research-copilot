import type { AuthUser } from "@/lib/auth";

/** Safe client-side session fetch — never throws on empty or invalid JSON. */
export async function fetchClientSession(): Promise<{ user: AuthUser | null }> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return { user: null };

    const text = await res.text();
    if (!text.trim()) return { user: null };

    const data = JSON.parse(text) as { user?: AuthUser | null };
    return { user: data.user ?? null };
  } catch {
    return { user: null };
  }
}
