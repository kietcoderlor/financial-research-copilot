"""Retrieve API (Phase 3)."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DocumentChunk
from app.db.session import get_session
from app.models.requests import RetrieveRequest
from app.models.responses import (
    RetrieveChunkResponse,
    RetrieveLatencyResponse,
    RetrieveResponse,
)
from app.retrieval.filters import normalize_filters
from app.retrieval.pipeline import retrieve

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retrieve", tags=["retrieve"])


async def _validate_companies(filters: list[str], session: AsyncSession) -> None:
    if not filters:
        return
    q = await session.execute(
        select(distinct(DocumentChunk.company_ticker)).where(DocumentChunk.company_ticker.in_(filters))
    )
    existing = {str(x) for x in q.scalars().all()}
    missing = sorted(set(filters) - existing)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown company ticker(s): {', '.join(missing)}",
        )


@router.post("", response_model=RetrieveResponse)
async def post_retrieve(
    body: RetrieveRequest,
    session: AsyncSession = Depends(get_session),
) -> RetrieveResponse:
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query must be non-empty")

    filters = normalize_filters(body.filters)
    await _validate_companies(filters.companies, session)

    result = await asyncio.to_thread(retrieve, query, filters, top_k=20, top_n=5)
    lat = result.latency_breakdown
    logger.info(
        "retrieve_latency embed_ms=%s vector_ms=%s bm25_ms=%s rerank_ms=%s total_ms=%s",
        lat["embed_ms"],
        lat["vector_ms"],
        lat["bm25_ms"],
        lat["rerank_ms"],
        lat["total_ms"],
    )
    return RetrieveResponse(
        chunks=[
            RetrieveChunkResponse(
                id=c.id,
                text=c.text,
                company=c.company,
                doc_type=c.doc_type,
                year=c.year,
                section=c.section,
                score=c.score,
            )
            for c in result.chunks
        ],
        latency=RetrieveLatencyResponse(
            embed_ms=lat["embed_ms"],
            vector_ms=lat["vector_ms"],
            bm25_ms=lat["bm25_ms"],
            rerank_ms=lat["rerank_ms"],
            total_ms=lat["total_ms"],
        ),
    )
