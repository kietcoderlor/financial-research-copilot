"""Query API (Phase 4): retrieval + grounded generation + citations."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Document, DocumentChunk
from app.db.session import get_session
from app.generation.citation_parser import extract_citation_indices, resolve_citations
from app.generation.classifier import classify_query, query_type_instructions
from app.generation.context_builder import build_context
from app.generation.llm import generate_answer
from app.generation.query_cache import cache_key, get_cached, put_cached
from app.models.requests import QueryRequest, RetrieveFilters
from app.models.responses import (
    QueryCitationResponse,
    QueryMetadataResponse,
    QueryResponse,
)
from app.retrieval.pipeline import retrieve

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])
_INSUFFICIENT = "I don't have sufficient information in the provided documents."
_STOPWORDS = {
    "what",
    "which",
    "from",
    "with",
    "that",
    "this",
    "about",
    "into",
    "between",
    "where",
    "when",
    "their",
    "there",
    "would",
    "could",
    "should",
    "apple",
}


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


async def _fetch_source_urls(
    session: AsyncSession,
    chunk_ids: list[UUID],
) -> dict[UUID, str | None]:
    if not chunk_ids:
        return {}
    q = await session.execute(
        select(DocumentChunk.id, Document.source_url)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(DocumentChunk.id.in_(chunk_ids))
    )
    return {cid: src for cid, src in q.all()}


async def _validate_companies(filters: RetrieveFilters, session: AsyncSession) -> None:
    if not filters.companies:
        return
    q = await session.execute(
        select(distinct(DocumentChunk.company_ticker)).where(
            DocumentChunk.company_ticker.in_(filters.companies)
        )
    )
    existing = {str(x) for x in q.scalars().all()}
    missing = sorted(set(filters.companies) - existing)
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown company ticker(s): {', '.join(missing)}")


def _keyword_set(text: str) -> set[str]:
    tokens = {t.lower() for t in re.findall(r"[A-Za-z][A-Za-z0-9\-]{3,}", text)}
    return {t for t in tokens if t not in _STOPWORDS}


def _context_sufficient(question: str, chunks: list[DocumentChunk | object]) -> bool:
    if not chunks:
        return False
    q_tokens = _keyword_set(question)
    if not q_tokens:
        return True
    text_blob = " ".join(getattr(c, "text", "") for c in chunks[:5])
    c_tokens = _keyword_set(text_blob)
    if not c_tokens:
        return False
    overlap = len(q_tokens & c_tokens) / max(1, len(q_tokens))
    return overlap >= 0.15


def _fallback_answer_with_citations(chunks: list[DocumentChunk | object]) -> str:
    lines = ["Based on the retrieved documents:"]
    for i, ch in enumerate(chunks[:3], start=1):
        raw = getattr(ch, "text", "").replace("\n", " ").strip()
        snippet = raw[:220].rstrip()
        lines.append(f"- {snippet} [{i}]")
    return "\n".join(lines)


@router.post("", response_model=QueryResponse)
async def post_query(
    body: QueryRequest,
    session: AsyncSession = Depends(get_session),
) -> QueryResponse:
    t_total = time.perf_counter()
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question must be non-empty")

    filters: RetrieveFilters = body.filters
    await _validate_companies(filters, session)
    key = cache_key(question, filters.model_dump())
    cached = get_cached(key)
    if cached:
        metadata = cached.get("metadata", {})
        metadata["retrieval_ms"] = 0
        metadata["llm_ms"] = 0
        metadata["input_tokens"] = 0
        metadata["output_tokens"] = 0
        metadata["llm_cost_usd"] = 0.0
        metadata["total_ms"] = _ms(t_total)
        metadata["cache_hit"] = True
        cached["metadata"] = metadata
        logger.info("query_cache event=hit")
        return QueryResponse.model_validate(cached)
    logger.info("query_cache event=miss")

    t_retr = time.perf_counter()
    retrieval = await asyncio.to_thread(retrieve, question, filters, top_k=20, top_n=5)
    retrieval_ms = _ms(t_retr)

    query_type = classify_query(question)
    ctx, kept_chunks = build_context(retrieval.chunks)
    extra_inst = query_type_instructions(query_type)

    if not _context_sufficient(question, kept_chunks):
        llm = type("LLMFallback", (), {"answer_text": _INSUFFICIENT, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})()
        llm_ms = 0
    elif not settings.anthropic_api_key:
        llm = type(
            "LLMFallback",
            (),
            {
                "answer_text": _fallback_answer_with_citations(kept_chunks),
                "input_tokens": 0,
                "output_tokens": 0,
                "cost_usd": 0.0,
            },
        )()
        llm_ms = 0
    else:
        t_llm = time.perf_counter()
        llm = await asyncio.to_thread(
            generate_answer,
            query=question,
            context_str=ctx,
            query_type=query_type,
            extra_instruction=extra_inst,
        )
        llm_ms = _ms(t_llm)

    indices = extract_citation_indices(llm.answer_text)
    resolved = resolve_citations(indices, kept_chunks)
    source_map = await _fetch_source_urls(session, [c.id for _, c in resolved])

    citations = [
        QueryCitationResponse(
            index=i,
            chunk_id=c.id,
            company=c.company,
            doc_type=c.doc_type,
            year=c.year,
            section=c.section,
            source_url=source_map.get(c.id),
            excerpt=(c.text[:400] + "...") if len(c.text) > 400 else c.text,
        )
        for i, c in resolved
    ]

    response = QueryResponse(
        answer=llm.answer_text,
        citations=citations,
        metadata=QueryMetadataResponse(
            query_type=query_type,
            chunks_retrieved=len(retrieval.chunks),
            chunks_used=len(kept_chunks),
            retrieval_ms=retrieval_ms,
            llm_ms=llm_ms,
            input_tokens=llm.input_tokens,
            output_tokens=llm.output_tokens,
            llm_cost_usd=llm.cost_usd,
            total_ms=_ms(t_total),
            cache_hit=False,
        ),
    )
    logger.info(
        "query_latency retrieval_ms=%s llm_ms=%s total_ms=%s llm_cost_usd=%.6f",
        retrieval_ms,
        llm_ms,
        response.metadata.total_ms,
        llm.cost_usd,
    )
    put_cached(key, response.model_dump(mode="json"))
    return response
