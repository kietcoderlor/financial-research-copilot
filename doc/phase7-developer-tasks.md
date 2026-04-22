# Developer Task Assignment — Phase 7 (Post-MVP, FAANG-target)

This document extends [developer-tasks.md](developer-tasks.md) with **Phase 7** — the work that turns a completed V1 into a portfolio project strong enough for FAANG SWE/AI intern applications. Phase 7 assumes Phases 1–6 are complete (or near-complete).

**See also:** [phase7-implementation-guide.md](phase7-implementation-guide.md) · [retrieval-debug-investigation.md](retrieval-debug-investigation.md) · [interview-prep-tracker.md](interview-prep-tracker.md) · [project-overview.md](project-overview.md)

---

## Goal of Phase 7

Phase 6 closes V1 as a working, measured product. Phase 7 adds three capabilities that FAANG recruiters and interviewers specifically look for:

1. **Scale story** — the system handles realistic load on a realistic corpus, with documented performance numbers.
2. **AI systems depth** — retrieval and generation use non-trivial techniques (routing, streaming, hallucination checks, LLM-as-judge, semantic caching) beyond a tutorial RAG.
3. **Engineering rigor** — automated evals in CI, integration tests, chaos tests, SLOs. This is the "senior engineer mindset" signal.

The output is not more features — it is **war stories for interviews**. Every task below is designed to produce a concrete metric, a decision to explain, or a problem you solved.

---

## Task ID Convention

- **P7-DEBUG** = Fix the current retrieval bug (blocks everything else)
- **P7-A** = Track A: Scale & Infrastructure
- **P7-B** = Track B: AI Engineering Depth
- **P7-C** = Track C: Engineering Rigor

**Scope:** S = Small (≈0.5–1 day) · M = Medium (1–2 days) · L = Large (2–3 days)

---

## Status Summary

| Track | Tasks | Done | Status |
|-------|-------|------|--------|
| **P7-DEBUG** Retrieval bug | 2 | 0 | Not started |
| **P7-A** Scale & Infra | 6 | 0 | Not started |
| **P7-B** AI Engineering | 6 | 0 | Not started |
| **P7-C** Engineering Rigor | 5 | 0 | Not started |

---

## P7-DEBUG: Fix Retrieval for Arbitrary Queries

*Blocker for the rest of Phase 7. Must be resolved first — otherwise the demo fails on any non-suggested query, and no amount of infrastructure work fixes user perception.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P7-DEBUG-1 | **Diagnose retrieval failure** – Follow `retrieval-debug-investigation.md` checklist end-to-end. Run corpus inventory SQL, test `/retrieve` and `/query` directly with `curl` on 5 arbitrary queries, inspect similarity threshold constants, verify filter state on frontend, check server-side logs for empty-result signatures. Document root cause in `docs/debug/retrieval-arbitrary-query-rca.md`. | S | — | - |
| P7-DEBUG-2 | **Implement fix based on RCA** – Apply the fix indicated by P7-DEBUG-1. Likely one or more of: (a) lower/remove similarity threshold, (b) expand corpus (see P7-A1), (c) reset frontend filter state between queries, (d) add a minimum-results fallback that relaxes filters when strict query returns <3 results. Add 10 arbitrary test queries to `eval/questions.csv` that cover the failure modes. | S | P7-DEBUG-1 | - |

**Definition of done:** 10 arbitrary queries (none of which match a suggested chip) return at least 3 semantically relevant chunks each. Root cause is documented. Regression test in place.

---

## P7-A: Scale & Infrastructure

*Goal: the system is provably production-grade under realistic load. Every task produces a number you can put on your resume or cite in an interview.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P7-A1 | **Expand corpus to 50+ companies** – Write `scripts/bulk_ingest_sp500.py` that reads a list of tickers from `data/sp500_subset.csv` (30–50 companies covering tech, finance, healthcare, energy, retail), downloads 10-K + latest 10-Q for each from EDGAR using `sec-edgar-downloader`, and enqueues them through `/ingest`. Respect SEC rate limit (10 req/sec). Run against production. After run, verify via `SELECT company_ticker, COUNT(*) FROM document_chunks GROUP BY 1 ORDER BY 2 DESC`. | M | P7-DEBUG-2 | - |
| P7-A2 | **Redis query cache layer** – Wrap `/query` and `/retrieve` with a Redis read-through cache. Cache key = `sha256(normalized_query + sorted_filters_json + endpoint_name)`. TTL default 3600s, configurable via env var `QUERY_CACHE_TTL_SECONDS`. Emit CloudWatch metrics `cache_hit`, `cache_miss`, derive `cache_hit_rate`. Do NOT cache `/ingest`. | S | — | - |
| P7-A3 | **Migrate pgvector index from IVFFlat to HNSW** – Create Alembic migration that drops existing IVFFlat index and creates HNSW (`m=16, ef_construction=64`). Write benchmark script `scripts/benchmark_index.py` that runs 50 queries across the corpus and measures recall@10 (vs brute-force ground truth) and p50/p95 latency. Document results in `docs/benchmarks/hnsw-vs-ivfflat.md`. | M | P7-A1 | - |
| P7-A4 | **Load test with k6** – Write `perf/query-load-test.js` with 3 scenarios: 10 VUs / 50 VUs / 100 VUs sustained for 2 minutes each with realistic query mix. Collect p50, p95, p99 latency for `/query` and `/retrieve`. Identify bottleneck (DB? embeddings? LLM?). Document results and bottleneck analysis in `docs/benchmarks/load-test-baseline.md`. Re-run after P7-A2 and P7-A3 to measure improvement. | M | P7-A2, P7-A3 | - |
| P7-A5 | **Auto-scaling ingestion worker** – In `infra/terraform/`, add ECS Service Auto Scaling for the ingestion worker: target tracking on SQS `ApproximateNumberOfMessagesVisible`, target value = 5, min_capacity = 1, max_capacity = 5. Test by enqueuing 100 documents and verifying in CloudWatch that worker count scales up and back down. | M | P7-A1 | - |
| P7-A6 | **CloudWatch dashboard + SLO** – Create CloudWatch dashboard `financial-copilot-prod` with widgets: p95 latency for /query and /retrieve, error rate, cache hit rate, SQS queue depth, active ECS tasks, daily LLM cost. Write `docs/slo.md` defining one SLO: "99% of /query requests complete within 2s over a 30-day window." Include error budget computation query. | S | P7-A2, P7-C3 | - |

**Definition of done (Track A):** Corpus has 30+ tickers and 5000+ chunks. Load test documents baseline and post-optimization numbers. Auto-scaling verified live. Dashboard URL shared in README. SLO documented.

---

## P7-B: AI Engineering Depth

*Goal: the retrieval and generation pipelines use techniques beyond a tutorial RAG. Each task should translate to a specific interview talking point.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P7-B1 | **Query router / classifier** – Create `app/retrieval/router.py`. Classify queries into `{factual, comparison, synthesis, adversarial}`. Use a two-stage approach: (1) keyword/regex rules for obvious cases, (2) Claude Haiku for ambiguous cases. Cache classification results in Redis (same query → same class). Route each class to a different retrieval strategy (e.g., comparison → P7-B3 multi-hop). Log routing decisions as structured logs. | M | P7-DEBUG-2 | - |
| P7-B2 | **Streaming response via SSE** – Add new endpoint `POST /query/stream` that returns Server-Sent Events. Stream tokens as Claude generates them. Citations resolve incrementally: emit `source` events as chunks are identified, `token` events during generation, `done` event at completion. Update Next.js frontend to consume the stream via `EventSource` or `fetch` with `ReadableStream`. Measure time-to-first-token vs time-to-full-response. | M | — | - |
| P7-B3 | **Multi-hop retrieval for comparison queries** – When the router (P7-B1) classifies a query as `comparison`, extract entity list (e.g., `["AAPL", "MSFT"]`) using Claude, run parallel retrieval per entity, merge with balanced top-k per entity (not global top-k), pass structured context to generator. Verify: "Apple vs Microsoft margins" returns chunks from both companies, roughly balanced. | M | P7-B1 | - |
| P7-B4 | **Hallucination detection** – After generation, for each sentence in the answer that contains a numeric claim or named entity, compute max cosine similarity against cited chunks. If max similarity < 0.72 (threshold tunable), flag the sentence. Log flags as `hallucination_flags` metric. Optionally add a warning badge in UI when flags present. Create 5 crafted test cases with known hallucinations to verify detection. | M | P7-A2 | - |
| P7-B5 | **LLM-as-judge evaluation** – Automate retrieval and generation eval. Create `eval/llm_judge.py` with two judge functions: `judge_retrieval(query, chunks) → relevance_scores[1..5]` and `judge_generation(query, answer, chunks) → {faithfulness, completeness, clarity}`. Use Claude Opus as judge with structured JSON output. Calibrate against 50 human-labeled examples from P6-2/P6-3; compute Cohen's kappa agreement. If kappa < 0.7, iterate the judge prompt and re-calibrate. Integrate into `eval/run_full_eval.py` so a 30-question benchmark runs unattended in <10 min. | M | P6-2, P6-3 | - |
| P7-B7 | **Semantic cache layer** – Extend exact-match cache (P7-A2) with semantic fallback. When exact-match misses, embed the query and search a new `cached_queries` table (columns: `id`, `query_text`, `query_embedding vector(1536)`, `response_json`, `filters_hash`, `created_at`) via pgvector cosine similarity. If top match score > threshold AND `filters_hash` matches exactly, return cached response. Tune threshold empirically: target ≥25% combined hit rate with <1% false hit rate on a labeled test set of 100 query pairs. Track `exact_cache_hit`, `semantic_cache_hit`, `cache_miss` as separate metrics. Document tradeoff in `docs/benchmarks/semantic-cache.md`. | M | P7-A2 | - |

**Definition of done (Track B):** Router classifies 20 test queries with >85% accuracy. Streaming shows first token <500ms. Multi-hop returns balanced results on 5 comparison test queries. Hallucination detector catches all 5 crafted test hallucinations. LLM judge shows ≥0.70 Cohen's kappa vs human labels. Semantic cache achieves ≥25% combined hit rate with documented false-hit rate.

**Note on task numbering:** P7-B6 (HyDE) was evaluated and deferred — see "What This Phase Does NOT Include" below. B5/B7 numbering preserves the slot in case you add HyDE later.

---

## P7-C: Engineering Rigor

*Goal: demonstrate "senior mindset" signals that separate strong intern candidates from great ones. Each item is small in isolation but collectively they signal maturity.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P7-C1 | **Automated eval in CI** – Add GitHub Actions job `eval-smoke` that runs on every PR: spin up Postgres + Redis in services, seed fixture corpus (3 small docs), run 5-query retrieval eval using the LLM judge from P7-B5, fail if Precision@5 drops >10% vs main baseline stored in `eval/baseline.json`. Update baseline on main merges. | M | P6-2, P7-B5 | - |
| P7-C2 | **Integration test suite with testcontainers** – Create `tests/integration/` using `pytest` + `testcontainers-python`. Spin up real Postgres (with pgvector), Redis, and ElasticMQ per test run. Tests: (a) full ingest → chunks exist → embeddings non-null, (b) query end-to-end returns cited answer, (c) deduplication prevents double-ingest, (d) DLQ receives message after 3 failures. | M | — | - |
| P7-C3 | **Cost tracking per query** – In `app/generation/generator.py`, after each LLM call, compute `cost_usd = input_tokens * input_price + output_tokens * output_price` using model-specific rates from `app/core/pricing.py`. Emit CloudWatch custom metric `llm_cost_usd` with dimension `model`. Add dashboard widget (P7-A6) summing daily cost. | S | — | - |
| P7-C4 | **Alembic migration CI check** – Add GitHub Actions step that runs `alembic check` and fails if the working tree has schema changes without a corresponding migration file. Prevents the "forgot to commit migration" class of bugs. | S | — | - |
| P7-C5 | **Chaos test: ingestion idempotency** – Write `tests/chaos/test_ingestion_idempotency.py`: enqueue a document, let worker start processing, kill worker process mid-embedding, wait for SQS visibility timeout, verify new worker picks up same message and completes without producing duplicate chunks. Document behavior in `docs/reliability/ingestion-idempotency.md`. | S | P7-C2 | - |

**Definition of done (Track C):** CI has retrieval smoke eval gate. Integration test suite green. Chaos test documents idempotency guarantee. Cost tracking visible on dashboard.

---

## Recommended Execution Order

Phase 7 is designed to be executed in order. Dependencies flow roughly: DEBUG → A1 (corpus) → A2/A3 (optimization) → A4 (measurement) → B/C tracks.

### Week 1 — Foundation
1. P7-DEBUG-1, P7-DEBUG-2 (must fix first)
2. P7-A1 (corpus expansion — unblocks meaningful benchmarks)
3. Parallel: P7-C3 (cost tracking — small, useful immediately)

### Week 2 — Optimization & Measurement
4. P7-A2 (Redis cache)
5. P7-A3 (HNSW migration + benchmark)
6. P7-A4 (load test baseline — **first number for resume**)

### Week 3 — AI Depth (part 1)
7. P7-B1 (query router)
8. P7-B2 (streaming response — **biggest demo UX win**)
9. P7-B7 (semantic cache — builds directly on P7-A2)

### Week 4 — AI Depth (part 2) + Testing
10. P7-B3 (multi-hop for comparisons)
11. P7-B5 (LLM-as-judge — enables automated eval in CI)
12. P7-C1 (automated eval in CI — unlocked by B5)
13. P7-C2 (integration tests)

### Week 5 — Final infra + polish
14. P7-A5 (auto-scaling)
15. P7-A6 (dashboard + SLO)
16. P7-B4 (hallucination detection)
17. P7-C4 (Alembic CI check)
18. P7-C5 (chaos test)

### Week 6 — Portfolio finish
19. Update README with all new numbers and decisions
20. Record new demo video showing streaming + multi-hop
21. Write one technical blog post explaining one decision: "Why I chose HNSW over IVFFlat" or "How semantic caching reduced p95 by 60%"
22. Update `interview-prep-tracker.md` with final numbers and rehearse

**MVP shortcut if time-constrained:** DEBUG → A1 → A2 → A4 → B2 → B5 → B7 → C1 → C2. Produces a scalable, tested, measured system with streaming demo and automated eval — enough for a strong portfolio piece. Skip B3/B4/A5/C5 if needed.

---

## FAANG-Specific Interview Prep Mapping

Each Phase 7 task is designed to produce at least one of: a **resume bullet**, a **system design talking point**, or a **behavioral story**. See `interview-prep-tracker.md` for the full mapping.

| Interview round | Tasks that produce material |
|-----------------|------------------------------|
| **Resume screen / recruiter call** | P7-A1 (corpus size), P7-A4 (latency numbers), P6-2 (Precision@5), P6-5 (before/after), P7-B5 (kappa agreement), P7-B7 (cache hit rate) |
| **System design (1 hour)** | P7-A3 (index choice), P7-A2 + P7-B7 (cache layers), P7-A5 (autoscaling), P7-B3 (multi-hop), P7-A6 (SLO + error budget) |
| **Coding (live DSA)** | Not covered by project — this is LeetCode territory. Grind separately. |
| **Behavioral (STAR)** | P7-DEBUG (debug), P7-C5 (reliability), P7-A4 (performance), P6-5 / P7-B5 (iteration), P7-A3 / P7-B7 (tradeoff) |
| **ML-focused round** | P7-B1 (classification), P7-B4 (hallucination), P7-B5 (eval rigor), P6-2 (offline eval design) |

Before interviews, write a 2-minute script for each talking point. See `interview-prep-tracker.md` for templates.

---

## What This Phase Does NOT Include

Intentionally deferred — do not build these now:

- **OAuth / user accounts** — Adds friction to demo, doesn't signal anything FAANG cares about at intern level.
- **User portfolios / saved queries** — Requires auth, adds complexity, low interview value.
- **Heavy UI redesign** — FAANG interviewers care about system behavior, not Figma polish. A clean shadcn/ui layout is enough.
- **Fine-tuning embeddings or LLM** — Corpus too small to justify; hard to defend decision to interviewers.
- **HyDE (Hypothetical Document Embeddings, originally B6)** — Considered and deferred. Value exists for synthesis queries, but integration complexity + marginal recall gain didn't justify the 2-day cost. Semantic cache (B7) provides clearer engineering story with same level of effort.
- **GraphRAG / knowledge graphs** — Corpus too small; trendy but over-engineered for this scale.
- **Multi-modal (chart/table extraction)** — Huge scope, requires vision model, filings are mostly text.
- **Agent framework loops (LangGraph, AutoGen)** — Router + multi-hop is already agentic enough for the use case.
- **Custom GraphQL / gRPC** — REST is the right choice here.

If you catch yourself wanting to build any of these, redirect to grinding LeetCode — that's the higher-ROI activity for year-2 FAANG apps.
