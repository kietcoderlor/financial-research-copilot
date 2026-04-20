"""Reciprocal Rank Fusion for hybrid retrieval."""

from __future__ import annotations

from app.retrieval.types import ChunkResult


def rrf_fuse(
    vector_results: list[ChunkResult],
    bm25_results: list[ChunkResult],
    *,
    k: int = 60,
    limit: int = 20,
) -> list[ChunkResult]:
    by_id: dict[str, ChunkResult] = {}
    scores: dict[str, float] = {}

    for rank, item in enumerate(vector_results, start=1):
        key = str(item.id)
        by_id[key] = item
        scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank)

    for rank, item in enumerate(bm25_results, start=1):
        key = str(item.id)
        by_id.setdefault(key, item)
        scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank)

    ranked_ids = sorted(scores, key=lambda cid: scores[cid], reverse=True)[:limit]
    fused: list[ChunkResult] = []
    for cid in ranked_ids:
        base = by_id[cid]
        fused.append(
            ChunkResult(
                id=base.id,
                text=base.text,
                company=base.company,
                doc_type=base.doc_type,
                year=base.year,
                section=base.section,
                score=float(scores[cid]),
            )
        )
    return fused
