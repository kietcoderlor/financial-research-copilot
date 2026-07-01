# Semantic cache tradeoffs (P7-B7)

## Design

Two-layer cache for `/query`:

1. **Exact match** — Redis SHA-256 of normalized question + filters (`app/generation/query_cache.py`)
2. **Semantic fallback** — pgvector cosine search on `cached_query_responses` table (`app/generation/semantic_cache.py`)

## Tuning

- `SEMANTIC_CACHE_THRESHOLD` default `0.92` — higher = fewer false hits, lower hit rate
- `filters_hash` must match exactly even when query embedding is similar (prevents cross-filter contamination)

## Metrics to track locally

- `endpoint_cache event=exact_hit` / `semantic_hit` / `miss` in API logs
- Run duplicate queries with paraphrases to estimate combined hit rate

## AWS deferral

CloudWatch custom metrics for `exact_cache_hit` / `semantic_cache_hit` can be added when the account is restored.
