import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md";
  showText?: boolean;
};

export function BrandLogo({ href = "/", size = "md", showText = true }: BrandLogoProps) {
  const box = size === "sm" ? "size-9 text-sm" : "size-10 text-sm";
  const inner = (
    <>
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-900/25 ${box}`}
      >
        <span className="font-bold text-white">FR</span>
      </div>
      {showText ? (
        <div className="min-w-0 leading-none">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
            Financial Research Copilot
          </p>
          <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">Citation-grounded SEC research</p>
        </div>
      ) : null}
    </>
  );

  if (!showText) {
    return (
      <Link href={href} className="inline-flex">
        <div
          className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-900/25 ${box}`}
        >
          <span className="font-bold text-white">FR</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className="flex min-w-0 items-center gap-3">
      {inner}
    </Link>
  );
}
