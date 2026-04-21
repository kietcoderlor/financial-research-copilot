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
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <label className="mb-2 block text-sm font-semibold text-zinc-800">Question</label>
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
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Press Ctrl+Enter to submit</span>
        <span>{value.length} chars</span>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || value.trim().length === 0}
        className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {loading ? "Searching..." : "Ask Copilot"}
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            type="button"
            key={example}
            onClick={() => onChange(example)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
