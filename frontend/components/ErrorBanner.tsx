"use client";

type ErrorBannerProps = {
  error: string | null;
  onRetry: () => void;
};

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  if (!error) {
    return null;
  }
  return (
    <section
      className="rounded-xl border border-red-200/90 bg-red-50/95 p-4 shadow-sm ring-1 ring-red-900/10"
      role="alert"
    >
      <p className="text-sm font-medium leading-relaxed text-red-950">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-red-300/90 bg-white px-3 py-1.5 text-xs font-semibold text-red-900 shadow-sm transition hover:bg-red-50"
      >
        Retry
      </button>
    </section>
  );
}
