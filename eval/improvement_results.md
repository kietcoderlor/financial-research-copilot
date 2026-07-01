# Retrieval Improvement Results (P6-5)

## Measured results (local, 50-query benchmark)

| Metric | Before (prod spot check) | After (local, Jul 2026) |
|--------|--------------------------|-------------------------|
| Benchmark size | 15 queries | **50 queries** |
| Mean Precision@5 | 0.20 | **0.468** |
| Queries ≥3/5 relevant | 3/15 (20%) | **21/50 (42%)** |
| Citation accuracy | — | **98%** (49/50) |
| Adversarial refusal | — | **100%** (5/5) |
| End-to-end p50 latency | — | **9.5s** (p95 18.6s) |

## Changes applied

1. BM25: `plainto_tsquery` → `websearch_to_tsquery`
2. Pipeline: progressive filter relaxation when <3 chunks
3. Query gate: overlap threshold 15% → 8%
4. Corpus: expanded to **14 docs / 10 tickers** via `seed_local.py`
5. Multi-hop retrieval for comparison queries

## Reproduce

```powershell
$env:API_URL = "http://localhost:8000"
py eval/run_full_eval.py
```

Results: `eval/retrieval_scores.md`, `eval/generation_scores.md`, `eval/baseline.json`
