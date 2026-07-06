"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Reveal, Stagger } from "@/components/motion/Reveal";
import { MetricCard } from "@/components/ui/MetricCard";
import { MetricCardSkeleton } from "@/components/ui/Skeleton";
import { SectionLabel } from "@/components/ui/SectionLabel";

type CorpusSummary = {
  chunks_total: number;
  tickers_total: number;
  documents_total: number;
  documents_done: number;
  documents_failed: number;
  latest_ingested_at: string | null;
};

type BenchmarkSummary = {
  question_count: number;
  mean_precision_at_5: number;
  citation_accuracy: number;
  adversarial_refusal_rate: number;
  query_latency_p50_ms: number;
  query_latency_p95_ms: number;
};

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default function DashboardPage() {
  const [corpus, setCorpus] = useState<CorpusSummary | null>(null);
  const [bench, setBench] = useState<BenchmarkSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [c, b] = await Promise.all([
          fetch("/api/meta/dashboard", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/meta/benchmark", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!cancelled) {
          setCorpus(c);
          setBench(b);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-grid-bg flex-1">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <Reveal delay={2}>
          <div>
            <SectionLabel>Overview</SectionLabel>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Project Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Corpus health and benchmark metrics at a glance.</p>
          </div>
        </Reveal>

        {loading ? (
          <Reveal delay={3}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <MetricCardSkeleton key={i} />
              ))}
            </div>
          </Reveal>
        ) : null}

        {corpus ? (
          <section className="space-y-4">
            <Reveal delay={3}>
              <SectionLabel>Corpus health</SectionLabel>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stagger start={4}>
                <MetricCard label="Total chunks" value={String(corpus.chunks_total)} accent />
                <MetricCard label="Tickers" value={String(corpus.tickers_total)} />
                <MetricCard label="Documents" value={String(corpus.documents_total)} />
                <MetricCard label="Done" value={String(corpus.documents_done)} />
                <MetricCard
                  label="Failed"
                  value={String(corpus.documents_failed)}
                  danger={corpus.documents_failed > 0}
                />
              </Stagger>
            </div>
            <Reveal delay={5}>
              <p className="text-xs text-[var(--text-muted)]">
                Last ingested:{" "}
                {corpus.latest_ingested_at ? new Date(corpus.latest_ingested_at).toLocaleString() : "n/a"}
              </p>
            </Reveal>
          </section>
        ) : null}

        {bench ? (
          <section className="space-y-4">
            <Reveal delay={4}>
              <SectionLabel>Benchmark snapshot</SectionLabel>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stagger start={5}>
                <MetricCard label="Questions" value={String(bench.question_count)} />
                <MetricCard label="Precision@5" value={bench.mean_precision_at_5.toFixed(3)} accent />
                <MetricCard label="Citation accuracy" value={pct(bench.citation_accuracy)} />
                <MetricCard label="Adversarial refusal" value={pct(bench.adversarial_refusal_rate)} />
                <MetricCard label="Latency p50" value={`${Math.round(bench.query_latency_p50_ms)} ms`} />
                <MetricCard label="Latency p95" value={`${Math.round(bench.query_latency_p95_ms)} ms`} />
              </Stagger>
            </div>
            <Reveal delay={7}>
              <p className="text-xs text-[var(--text-muted)]">
                Source: <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5">eval/baseline.json</code>
              </p>
            </Reveal>
          </section>
        ) : null}

        <Reveal delay={6}>
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Ready to query?</p>
              <p className="text-xs text-[var(--text-muted)]">Jump into the research copilot workspace.</p>
            </div>
            <Link href="/app" className="btn-primary">
              Launch copilot
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
