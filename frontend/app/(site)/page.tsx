"use client";

import { useEffect, useState } from "react";

import { PageFooter } from "@/components/layout/PageFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { Reveal, RevealGroup, Stagger } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import type { AuthUser } from "@/lib/auth";
import { fetchClientSession } from "@/lib/clientSession";

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
    index: "01",
  },
  {
    title: "Grounded citations",
    body: "Every claim links to source chunks — citation accuracy benchmarked at 96% on 50 queries.",
    index: "02",
  },
  {
    title: "Adversarial guardrails",
    body: "Refuses out-of-corpus questions with 100% adversarial refusal in eval runs.",
    index: "03",
  },
] as const;

export default function LandingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [corpus, setCorpus] = useState<CorpusSummary | null>(null);
  const [bench, setBench] = useState<BenchmarkSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [session, c, b] = await Promise.all([
          fetchClientSession(),
          fetch("/api/meta/dashboard", { cache: "no-store" }).then(async (r) => {
            if (!r.ok) return null;
            const text = await r.text();
            return text.trim() ? (JSON.parse(text) as CorpusSummary) : null;
          }),
          fetch("/api/meta/benchmark", { cache: "no-store" }).then(async (r) => {
            if (!r.ok) return null;
            const text = await r.text();
            return text.trim() ? (JSON.parse(text) as BenchmarkSummary) : null;
          }),
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

  return (
    <div className="app-grid-bg flex flex-1 flex-col">
      <main className="landing-shell flex-1 pb-16 pt-8 md:pt-10">
        <LandingHero user={user} />

        {corpus && bench ? (
          <Reveal delay={2}>
            <section className="landing-stats" aria-label="Corpus and benchmark metrics">
              <div className="landing-stats-grid">
                <Stagger start={1}>
                  <MetricCard label="Indexed chunks" value={corpus.chunks_total.toLocaleString()} />
                  <MetricCard label="Tickers" value={String(corpus.tickers_total)} />
                  <MetricCard label="Precision@5" value={bench.mean_precision_at_5.toFixed(2)} />
                  <MetricCard label="Citation accuracy" value={`${(bench.citation_accuracy * 100).toFixed(0)}%`} />
                </Stagger>
              </div>
            </section>
          </Reveal>
        ) : null}

        <RevealGroup as="section" className="landing-features" aria-label="Product capabilities">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <p className="font-mono text-[11px] tracking-wide text-[var(--text-muted)]">{feature.index}</p>
              <h2 className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{feature.body}</p>
            </article>
          ))}
        </RevealGroup>

        <Reveal delay={1}>
          <section className="landing-cta panel">
            <div className="landing-cta-inner">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                  Secure access for your team
                </h2>
                <p className="mt-2 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
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

      <PageFooter />
    </div>
  );
}
