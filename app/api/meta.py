"""Small read-only metadata endpoints for UI (e.g. available company tickers)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document, DocumentChunk
from app.db.session import get_session

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/companies")
async def list_company_tickers(session: AsyncSession = Depends(get_session)) -> list[str]:
    """Distinct company tickers present in ingested chunks (for filter UI)."""
    result = await session.execute(
        select(distinct(DocumentChunk.company_ticker)).order_by(DocumentChunk.company_ticker)
    )
    return [str(row) for row in result.scalars().all()]


@router.get("/dashboard")
async def dashboard_summary(session: AsyncSession = Depends(get_session)) -> dict:
    """Corpus and ingestion summary metrics for dashboard UI."""
    chunks_total = (
        await session.execute(select(func.count()).select_from(DocumentChunk))
    ).scalar_one()
    tickers_total = (
        await session.execute(select(func.count(distinct(DocumentChunk.company_ticker))))
    ).scalar_one()
    docs_total = (await session.execute(select(func.count()).select_from(Document))).scalar_one()
    docs_done = (
        await session.execute(select(func.count()).select_from(Document).where(Document.status == "done"))
    ).scalar_one()
    docs_failed = (
        await session.execute(select(func.count()).select_from(Document).where(Document.status == "failed"))
    ).scalar_one()
    latest_ingested_at = (
        await session.execute(select(func.max(Document.ingested_at)))
    ).scalar_one()

    return {
        "chunks_total": int(chunks_total or 0),
        "tickers_total": int(tickers_total or 0),
        "documents_total": int(docs_total or 0),
        "documents_done": int(docs_done or 0),
        "documents_failed": int(docs_failed or 0),
        "latest_ingested_at": latest_ingested_at.isoformat() if latest_ingested_at else None,
    }
