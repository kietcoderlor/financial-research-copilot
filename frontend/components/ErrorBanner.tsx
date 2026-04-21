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
    <section className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-700">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
      >
        Retry
      </button>
    </section>
  );
}
