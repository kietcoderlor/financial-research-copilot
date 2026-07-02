"use client";

import { useEffect, useState } from "react";

import { PageFooter } from "@/components/layout/PageFooter";
import { Reveal, RevealGroup, Stagger } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import type { AuthUser } from "@/lib/auth";

type CorpusSummary = {
  chunks_total: number;
  tickers_total: number;
  documents_total: number;
};

type BenchmarkSummary = {
  mean_precision_at_5: number;
  citation_accuracy: number;
  adversarial_refusal_rate: number;
};

const FEATURES = [
  {
    title: "Hybrid retrieval",
    body: "Dense embeddings + BM25 + Cohere rerank over SEC 10-K/10-Q and earnings transcripts.",
    icon: "⌁",
  },
  {
    title: "Grounded citations",
    body: "Every claim links to source chunks — citation accuracy benchmarked at 96% on 50 queries.",
    icon: "◎",
  },
  {
    title: "Adversarial guardrails",
    body: "Refuses out-of-corpus questions with 100% adversarial refusal in eval runs.",
    icon: "⛨",
  },
];

export default function LandingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [corpus, setCorpus] = useState<CorpusSummary | null>(null);
  const [bench, setBench] = useState<BenchmarkSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [session, c, b] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/meta/dashboard", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/meta/benchmark", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!cancelled) {
          setUser(session.user ?? null);
          setCorpus(c);
          setBench(b);
        }
      } catch {
        /* optional stats */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const ctaHref = user ? "/dashboard" : "/auth/signup";
  const ctaLabel = user ? "Open dashboard" : "Get started free";

  return (
    <div className="app-grid-bg flex flex-1 flex-col">
      <main className="mx-auto max-w-6xl flex-1 px-6 pb-20 pt-6">
        <section className="hero-panel flex min-h-[min(88vh,920px)] flex-col justify-center p-8 md:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 size-56 rounded-full bg-cyan-500/10 blur-3xl" />

          <Reveal delay={2}>
            <span className="eyebrow-badge">Production-grade RAG</span>
          </Reveal>

          <Reveal delay={3}>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] md:text-5xl">
              Research SEC filings with answers you can{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                verify in one click
              </span>
            </h1>
          </Reveal>

          <Reveal delay={4}>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--text-muted)]">
              Ask natural-language questions over 10-K, 10-Q, and earnings transcripts. Hybrid retrieval, reranking, and
              inline citations built for analysts — not chatbot guesswork.
            </p>
          </Reveal>

          <Reveal delay={5} className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={ctaHref} variant="primary">
              {ctaLabel}
            </Button>
            <Button href={user ? "/app" : "/auth/signin?next=/app"} variant="secondary">
              {user ? "Launch copilot" : "Sign in to query"}
            </Button>
          </Reveal>

          {corpus && bench ? (
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stagger start={6}>
                <MetricCard label="Indexed chunks" value={corpus.chunks_total.toLocaleString()} accent />
                <MetricCard label="Tickers" value={String(corpus.tickers_total)} />
                <MetricCard label="Precision@5" value={bench.mean_precision_at_5.toFixed(2)} accent />
                <MetricCard
                  label="Citation accuracy"
                  value={`${(bench.citation_accuracy * 100).toFixed(0)}%`}
                />
              </Stagger>
            </div>
          ) : null}
        </section>

        <RevealGroup as="section" className="mt-16 grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="glass-panel group rounded-2xl p-6 transition hover:border-emerald-500/25">
              <span className="text-lg text-emerald-500">{feature.icon}</span>
              <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{feature.body}</p>
            </article>
          ))}
        </RevealGroup>

        <Reveal delay={1} className="mt-24">
          <section className="glass-panel rounded-2xl p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  Secure access for your team
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
                  Sign up with Google or email OTP. Verify once and jump into the research workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button href="/auth/signup" variant="primary">
                  Create account
                </Button>
                <Button href="/auth/signin" variant="secondary">
                  Sign in
                </Button>
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      <Reveal delay={4}>
        <PageFooter />
      </Reveal>
    </div>
  );
}
