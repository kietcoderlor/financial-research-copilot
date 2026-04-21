"""Small read-only metadata endpoints for UI (e.g. available company tickers)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DocumentChunk
from app.db.session import get_session

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/companies")
async def list_company_tickers(session: AsyncSession = Depends(get_session)) -> list[str]:
    """Distinct company tickers present in ingested chunks (for filter UI)."""
    result = await session.execute(
        select(distinct(DocumentChunk.company_ticker)).order_by(DocumentChunk.company_ticker)
    )
    return [str(row) for row in result.scalars().all()]
