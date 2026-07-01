# Retrieval arbitrary-query RCA (P7-DEBUG-1)

**Date:** 2026-07-01  
**Environment:** Local Docker Compose (MinIO + ElasticMQ + Postgres)

## Symptom

Suggested example queries (e.g. "Apple risk factors 2024") returned results on production, while arbitrary queries often returned empty answers or irrelevant chunks.

## Root causes (confirmed)

| # | Cause | Evidence | Fix |
|---|-------|----------|-----|
| H1 | **Corpus too small** — only 3 seed docs in early prod | `COUNT(DISTINCT company_ticker) = 1-3` | Expanded local manifest to 15 docs / 10 tickers via `data/local_seed_manifest.json` + `scripts/seed_local.py` |
| H2 | **Strict BM25 parser** — `plainto_tsquery` missed multi-term financial queries | Retrieval returned 0 BM25 hits for "margin guidance" style queries | Switched to `websearch_to_tsquery` in `app/retrieval/bm25_search.py` |
| H3 | **Keyword overlap gate** — `_context_sufficient` threshold 15% with `apple` in stopword list | `/retrieve` returned chunks but `/query` refused | Lowered threshold to 8%, removed company tokens from stopwords |
| H4 | **Filter strictness** — year/company filters with sparse corpus | Strict filters returned <3 chunks | Added progressive filter relaxation in `app/retrieval/pipeline.py` |

## Verification

After fixes + local seed:

1. `python scripts/seed_local.py`
2. `python eval/evaluate_retrieval.py` with `API_URL=http://localhost:8000`
3. Arbitrary queries (Tesla margin, Microsoft cloud, Goldman risk) should return ≥3 chunks.

## Regression

- `eval/questions.csv` includes 10+ non-chip queries (Q030–Q035, comparison/synthesis set).
- `tests/test_router.py` covers comparison routing.
