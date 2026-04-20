"""Retrieval orchestration pipeline."""

from __future__ import annotations

import time

from app.models.requests import RetrieveFilters
from app.retrieval.bm25_search import search_bm25
from app.retrieval.filters import normalize_filters
from app.retrieval.fusion import rrf_fuse
from app.retrieval.query_embedder import embed_query
from app.retrieval.reranker import rerank
from app.retrieval.types import RetrievalResult
from app.retrieval.vector_search import search_vector


def _ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def retrieve(
    query: str,
    filters: RetrieveFilters,
    *,
    top_k: int = 20,
    top_n: int = 5,
) -> RetrievalResult:
    total_t0 = time.perf_counter()
    norm_filters = normalize_filters(filters)

    t0 = time.perf_counter()
    query_vec = embed_query(query)
    embed_ms = _ms(t0)

    t0 = time.perf_counter()
    vector = search_vector(query_vec, norm_filters, limit=top_k)
    vector_ms = _ms(t0)

    t0 = time.perf_counter()
    bm25 = search_bm25(query, norm_filters, limit=top_k)
    bm25_ms = _ms(t0)

    fused = rrf_fuse(vector, bm25, limit=top_k)

    t0 = time.perf_counter()
    chunks = rerank(query, fused, top_n=top_n)
    rerank_ms = _ms(t0)

    return RetrievalResult(
        chunks=chunks,
        latency_breakdown={
            "embed_ms": embed_ms,
            "vector_ms": vector_ms,
            "bm25_ms": bm25_ms,
            "rerank_ms": rerank_ms,
            "total_ms": _ms(total_t0),
        },
    )
