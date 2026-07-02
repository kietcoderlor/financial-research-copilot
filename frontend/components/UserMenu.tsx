"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AuthUser } from "@/lib/auth";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { user: AuthUser | null }) => {
        if (!cancelled) setUser(data.user);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth/signin"
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Sign in
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        {user.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image_url} alt="" className="size-6 rounded-full" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-400">
            {initials}
          </span>
        )}
        <span className="max-w-[120px] truncate">{user.name || user.email}</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-xl">
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            onClick={() => setOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/app"
            className="block rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            onClick={() => setOpen(false)}
          >
            Research Copilot
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="block w-full rounded-lg px-3 py-2 text-left text-xs text-rose-400 hover:bg-[var(--bg-surface)]"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
