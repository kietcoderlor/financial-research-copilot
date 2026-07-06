"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppNav } from "@/components/ui/AppNav";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { MAIN_NAV, type NavItem } from "@/lib/navigation";

type SiteHeaderProps = {
  nav?: NavItem[];
  actions?: ReactNode;
  logoHref?: string;
  showNav?: boolean;
};

type HealthState = "checking" | "ok" | "degraded";

function CopilotLiveBadge({ health = "checking" }: { health?: HealthState }) {
  const label = health === "degraded" ? "Degraded" : health === "ok" ? "Live" : "Checking";
  const toneClass = health === "degraded" ? "status-live-degraded" : health === "ok" ? "status-live-ok" : "status-live-checking";

  return (
    <span className={`status-live ${toneClass} hidden sm:inline-flex`}>
      <span className="status-live-dot" />
      {label}
    </span>
  );
}

export function SiteHeader({
  nav = MAIN_NAV,
  actions,
  logoHref = "/",
  showNav = true,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const onCopilot = pathname === "/app" || pathname.startsWith("/app/");
  const [healthState, setHealthState] = useState<HealthState>("checking");

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as { degraded?: boolean; status?: string };
        if (!alive) return;
        setHealthState(data.degraded || data.status === "degraded" ? "degraded" : "ok");
      } catch {
        if (!alive) return;
        setHealthState("degraded");
      }
    }

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 30000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const defaultActions = useMemo(
    () => (onCopilot ? <CopilotLiveBadge health={healthState} /> : null),
    [healthState, onCopilot],
  );
  const headerActions = actions ?? defaultActions;

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center">
            <BrandLogo href={logoHref} size="md" />
          </div>

          {showNav ? (
            <div className="flex items-center justify-center">
              <AppNav items={nav} />
            </div>
          ) : (
            <div />
          )}

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-2 sm:gap-3">
            {headerActions}
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="site-header-spacer" aria-hidden />
    </>
  );
}
