"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { isNavActive, MAIN_NAV, type NavItem } from "@/lib/navigation";

type AppNavProps = {
  items?: NavItem[];
};

export function AppNav({ items = MAIN_NAV }: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-pill ${active ? "nav-pill-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative md:hidden">
        <button
          type="button"
          className="nav-pill flex items-center gap-1.5"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Open menu"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Menu
        </button>
        {open ? (
          <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-xl">
            {items.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${active ? "bg-[var(--accent-dim)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );
}
