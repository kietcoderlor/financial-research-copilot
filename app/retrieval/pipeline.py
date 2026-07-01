"""Retrieval orchestration pipeline."""

from __future__ import annotations

import logging
import time

from app.models.requests import RetrieveFilters
from app.retrieval.bm25_search import search_bm25
from app.retrieval.filters import normalize_filters
from app.retrieval.fusion import rrf_fuse
from app.retrieval.query_embedder import embed_query
from app.retrieval.reranker import rerank
from app.retrieval.router import extract_comparison_entities, route_query
from app.retrieval.types import ChunkResult, RetrievalResult
from app.retrieval.vector_search import search_vector

logger = logging.getLogger(__name__)
_MIN_RESULTS = 3


def _ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def _retrieve_core(
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


def _merge_balanced(per_entity: list[list[ChunkResult]], top_n: int) -> list[ChunkResult]:
    if not per_entity:
        return []
    merged: list[ChunkResult] = []
    seen: set[str] = set()
    per_slot = max(1, top_n // max(1, len(per_entity)))
    for bucket in per_entity:
        for ch in bucket[:per_slot]:
            cid = str(ch.id)
            if cid in seen:
                continue
            seen.add(cid)
            merged.append(ch)
    for bucket in per_entity:
        for ch in bucket:
            if len(merged) >= top_n:
                break
            cid = str(ch.id)
            if cid in seen:
                continue
            seen.add(cid)
            merged.append(ch)
    return merged[:top_n]


def _multi_hop_retrieve(
    query: str,
    filters: RetrieveFilters,
    *,
    top_k: int = 20,
    top_n: int = 5,
) -> RetrievalResult:
    entities = extract_comparison_entities(query)
    if len(entities) < 2:
        return _retrieve_core(query, filters, top_k=top_k, top_n=top_n)

    buckets: list[list[ChunkResult]] = []
    total_lat = {"embed_ms": 0, "vector_ms": 0, "bm25_ms": 0, "rerank_ms": 0, "total_ms": 0}
    for ticker in entities:
        entity_filters = RetrieveFilters(
            companies=[ticker],
            years=list(filters.years),
            doc_types=list(filters.doc_types),
        )
        partial = _retrieve_core(query, entity_filters, top_k=top_k, top_n=top_n)
        buckets.append(partial.chunks)
        for k, v in partial.latency_breakdown.items():
            total_lat[k] = total_lat.get(k, 0) + v

    merged = _merge_balanced(buckets, top_n)
    logger.info("multi_hop entities=%s chunks=%s", entities, len(merged))
    return RetrievalResult(chunks=merged, latency_breakdown=total_lat)


def _relax_filters(filters: RetrieveFilters) -> list[RetrieveFilters]:
    candidates: list[RetrieveFilters] = []
    if filters.years or filters.doc_types:
        candidates.append(
            RetrieveFilters(companies=list(filters.companies), years=[], doc_types=list(filters.doc_types))
        )
    if filters.companies:
        candidates.append(RetrieveFilters(companies=[], years=list(filters.years), doc_types=list(filters.doc_types)))
    candidates.append(RetrieveFilters(companies=[], years=[], doc_types=[]))
    return candidates


def retrieve(
    query: str,
    filters: RetrieveFilters,
    *,
    top_k: int = 20,
    top_n: int = 5,
) -> RetrievalResult:
    route = route_query(query)
    if route == "comparison":
        result = _multi_hop_retrieve(query, filters, top_k=top_k, top_n=top_n)
    else:
        result = _retrieve_core(query, filters, top_k=top_k, top_n=top_n)

    if len(result.chunks) >= _MIN_RESULTS:
        return result

    for relaxed in _relax_filters(normalize_filters(filters)):
        if relaxed == normalize_filters(filters):
            continue
        alt = _retrieve_core(query, relaxed, top_k=top_k, top_n=top_n)
        if len(alt.chunks) > len(result.chunks):
            logger.info(
                "retrieve_filter_fallback relaxed_companies=%s relaxed_years=%s chunks=%s",
                relaxed.companies,
                relaxed.years,
                len(alt.chunks),
            )
            result = alt
        if len(result.chunks) >= _MIN_RESULTS:
            break
    return result
