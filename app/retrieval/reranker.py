"""Cohere reranker wrapper for top-n retrieval."""

from __future__ import annotations

import logging

import cohere
import tiktoken

from app.core.config import settings
from app.retrieval.types import ChunkResult

logger = logging.getLogger(__name__)
_ENC = tiktoken.get_encoding("cl100k_base")


def _truncate_for_rerank(text: str, max_tokens: int = 512) -> str:
    ids = _ENC.encode(text)
    if len(ids) <= max_tokens:
        return text
    return _ENC.decode(ids[:max_tokens])


def rerank(query: str, candidates: list[ChunkResult], *, top_n: int = 5) -> list[ChunkResult]:
    if not candidates:
        return []
    if not settings.cohere_api_key:
        return candidates[:top_n]

    try:
        client = cohere.ClientV2(api_key=settings.cohere_api_key)
        docs = [{"text": _truncate_for_rerank(c.text)} for c in candidates]
        resp = client.rerank(
            model="rerank-v3.5",
            query=query,
            documents=docs,
            top_n=min(top_n, len(candidates)),
        )
        out: list[ChunkResult] = []
        for item in resp.results:
            base = candidates[item.index]
            out.append(
                ChunkResult(
                    id=base.id,
                    text=base.text,
                    company=base.company,
                    doc_type=base.doc_type,
                    year=base.year,
                    section=base.section,
                    score=float(item.relevance_score),
                )
            )
        return out
    except Exception:
        logger.exception("cohere_rerank_failed fallback=fused_order")
        return candidates[:top_n]
