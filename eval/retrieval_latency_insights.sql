fields @timestamp, @message
| filter @message like /retrieve_latency/
| parse @message "embed_ms=* vector_ms=* bm25_ms=* rerank_ms=* total_ms=*" as embed_ms, vector_ms, bm25_ms, rerank_ms, total_ms
| stats
    pct(to_number(embed_ms), 50) as embed_p50,
    pct(to_number(embed_ms), 95) as embed_p95,
    pct(to_number(vector_ms), 50) as vector_p50,
    pct(to_number(vector_ms), 95) as vector_p95,
    pct(to_number(bm25_ms), 50) as bm25_p50,
    pct(to_number(bm25_ms), 95) as bm25_p95,
    pct(to_number(rerank_ms), 50) as rerank_p50,
    pct(to_number(rerank_ms), 95) as rerank_p95,
    pct(to_number(total_ms), 50) as total_p50,
    pct(to_number(total_ms), 95) as total_p95
