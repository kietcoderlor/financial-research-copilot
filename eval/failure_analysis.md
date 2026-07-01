# Retrieval Failure Analysis (P6-4)

Based on pre-fix spot checks (`eval/retrieval_results.md`) and local re-evaluation.

## Worst-performing query patterns

| Pattern | Example | Root cause |
|---------|---------|------------|
| Multi-topic Apple queries without year match | "Apple management discussion on revenue trends" | Corpus gap + strict year/doc_type filters |
| Cross-company queries with single-ticker corpus | "Compare Apple and Microsoft" | Missing MSFT documents |
| Financial term queries | "quantitative disclosures market risk" | BM25 `plainto_tsquery` tokenization |
| Non-chip arbitrary queries | "Tesla margin guidance" | No TSLA chunks in seed corpus |

## Primary root causes

1. **Missing data (≈60%)** — production seed had only AAPL-focused samples.
2. **Retrieval strategy (≈25%)** — BM25 query mode and no filter fallback.
3. **Generation gate (≈10%)** — `_context_sufficient` overlap check too aggressive.
4. **Metadata mismatch (≈5%)** — filter years excluded available docs.

## Recommended fix (implemented in P6-5)

Single targeted improvement: **BM25 `websearch_to_tsquery` + filter relaxation fallback + expanded local corpus**.
