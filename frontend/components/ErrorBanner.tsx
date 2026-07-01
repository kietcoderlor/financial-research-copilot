"use client";

type ErrorBannerProps = {
  error: string | null;
  onRetry: () => void;
};

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  if (!error) return null;
  return (
    <section
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
      role="alert"
    >
      <p className="text-sm font-medium text-red-200">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
      >
        Retry query
      </button>
    </section>
  );
}
