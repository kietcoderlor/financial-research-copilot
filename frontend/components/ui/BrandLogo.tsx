import Link from "next/link";

import { BrandMark } from "@/components/ui/BrandMark";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md";
  showText?: boolean;
};

const MARK_SIZE = { sm: 28, md: 32 } as const;

export function BrandLogo({ href = "/", size = "md", showText = true }: BrandLogoProps) {
  const markSize = MARK_SIZE[size];
  const markShell = size === "sm" ? "brand-mark-shell-sm" : "brand-mark-shell";

  const mark = (
    <span className={markShell}>
      <BrandMark size={markSize} />
    </span>
  );

  if (!showText) {
    return (
      <Link href={href} className="inline-flex shrink-0" aria-label="Financial Research Copilot home">
        {mark}
      </Link>
    );
  }

  return (
    <Link href={href} className="flex min-w-0 items-center gap-2.5">
      {mark}
      <div className="min-w-0 leading-none">
        <p className="truncate text-sm font-medium leading-tight tracking-tight text-[var(--text-primary)]">
          Financial Research Copilot
        </p>
        <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">Citation-grounded SEC research</p>
      </div>
    </Link>
  );
}
