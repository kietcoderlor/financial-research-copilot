"use client";

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

function CopilotLiveBadge({ visible = true }: { visible?: boolean }) {
  return (
    <span className={`status-live hidden sm:inline-flex ${visible ? "" : "invisible"}`} aria-hidden={!visible}>
      <span className="status-live-dot" />
      Live
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
  const headerActions = actions ?? <CopilotLiveBadge visible={onCopilot} />;

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

          <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
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
