# pgvector index notes (P7-A3)

The schema already uses **HNSW** (`m=16`, `ef_construction=64`) in migration `p2_batch1_001`.

## Why HNSW

- Better recall/latency tradeoff than IVFFlat on small-to-medium corpora (<100k chunks)
- No training step required (IVFFlat needs `lists` tuning per corpus size)

## Benchmark

Run against local API after seed:

```bash
python scripts/benchmark_index.py
```

Record p50/p95 `/retrieve` latency and average chunks returned.

## IVFFlat comparison

Not migrated from IVFFlat in this repo — initial migration chose HNSW. For interviews: "I selected HNSW upfront to avoid reindex downtime and because corpus size is <10k chunks."
