"use client";

type QueryInputProps = {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

const EXAMPLES = [
  "Apple risk factors 2024",
  "Compare Apple and Berkshire business risks",
  "Bull and bear case for Apple in 2024 filings",
];

export function QueryInput({ value, loading, onChange, onSubmit }: QueryInputProps) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-950/5">
      <label className="mb-2 block text-sm font-semibold text-stone-900">Question</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === "Enter" && !loading) {
            event.preventDefault();
            onSubmit();
          }
        }}
        rows={5}
        placeholder="Ask about filings, transcripts, or compare companies..."
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-stone-900 placeholder:text-stone-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-stone-600">
        <span>Press Ctrl+Enter to submit</span>
        <span className="tabular-nums text-stone-700">{value.length} chars</span>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || value.trim().length === 0}
        className="mt-3 w-full rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
      >
        {loading ? "Searching…" : "Run query"}
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            type="button"
            key={example}
            onClick={() => onChange(example)}
            className="rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 transition hover:border-stone-400 hover:bg-white"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
