"""Ingest API (P2-10, P2-11)."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document, DocumentChunk
from app.db.session import get_session
from app.ingestion.queue import send_ingest_message
from app.models.requests import IngestCreateRequest
from app.models.responses import IngestQueuedResponse, IngestStatusResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestQueuedResponse)
async def create_ingest(
    body: IngestCreateRequest,
    session: AsyncSession = Depends(get_session),
) -> IngestQueuedResponse:
    doc = Document(
        s3_key=body.s3_key,
        company_ticker=body.company_ticker,
        company_name=body.company_name,
        doc_type=body.doc_type,
        year=body.year,
        quarter=body.quarter,
        source_url=body.source_url,
        status="pending",
    )
    session.add(doc)
    await session.flush()
    doc_id = doc.id
    # Commit the document row before enqueuing so worker can always read it.
    await session.commit()
    try:
        await asyncio.to_thread(
            send_ingest_message,
            document_id=doc_id,
            s3_key=body.s3_key,
            company_ticker=body.company_ticker,
            company_name=body.company_name,
            doc_type=body.doc_type,
            year=body.year,
            quarter=body.quarter,
        )
    except Exception:
        logger.exception("ingest_sqs_failed document_id=%s", doc_id)
        db_doc = await session.get(Document, doc_id)
        if db_doc is not None:
            db_doc.status = "failed"
            await session.commit()
        raise HTTPException(status_code=502, detail="Failed to enqueue ingestion job")
    return IngestQueuedResponse(document_id=doc_id, status="queued")


@router.get("/{document_id}", response_model=IngestStatusResponse)
async def get_ingest_status(
    document_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> IngestStatusResponse:
    doc = await session.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    q = await session.execute(
        select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    chunk_count = int(q.scalar_one())
    return IngestStatusResponse(
        document_id=doc.id,
        status=doc.status,
        chunk_count=chunk_count,
    )
