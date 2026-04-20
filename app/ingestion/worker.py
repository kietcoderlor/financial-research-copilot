"""SQS ingestion worker (P2-9): S3 → parse → chunk → embed → Postgres."""

from __future__ import annotations

import json
import logging
import time
from typing import Any
from uuid import UUID

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.models import Document, DocumentChunk
from app.ingestion.chunker import ChunkRecord, chunk_text
from app.ingestion.embedder import embed_texts
from app.ingestion.parsers.pdf_parser import parse_pdf_bytes
from app.ingestion.parsers.sec_parser import parse_sec_filing_html
from app.ingestion.parsers.transcript_parser import parse_transcript_sections

logger = logging.getLogger(__name__)


def _sync_db_url() -> str:
    return settings.db_url.replace("postgresql+asyncpg://", "postgresql://")


def _s3_client():
    kwargs: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


def _sqs_client():
    kwargs: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.resolved_sqs_endpoint_url:
        kwargs["endpoint_url"] = settings.resolved_sqs_endpoint_url
    return boto3.client("sqs", **kwargs)


def _download_s3_bytes(s3_key: str) -> bytes:
    obj = _s3_client().get_object(Bucket=settings.s3_bucket, Key=s3_key)
    return obj["Body"].read()


def _is_likely_sec_html(raw: str) -> bool:
    head = raw[:8000].lower()
    return "<html" in head or "<document" in head or "<type>10-k</type>" in head or "<type>10-q</type>" in head


def _build_chunk_plan(doc: Document, raw_bytes: bytes) -> list[ChunkRecord]:
    dt_lo = doc.doc_type.lower().strip()
    if raw_bytes[:4] == b"%PDF" or dt_lo in ("letter", "shareholder_letter", "annual_letter", "pdf"):
        text = parse_pdf_bytes(raw_bytes)
        return chunk_text(text, None)

    raw = raw_bytes.decode("utf-8", errors="replace")

    if dt_lo == "transcript":
        recs: list[ChunkRecord] = []
        for sec, block in parse_transcript_sections(raw):
            recs.extend(chunk_text(block, sec))
        return recs

    if doc.doc_type.upper() in ("10-K", "10-Q") and _is_likely_sec_html(raw):
        recs: list[ChunkRecord] = []
        for sec in parse_sec_filing_html(raw):
            recs.extend(chunk_text(sec.text, sec.label))
        return recs if recs else chunk_text(raw, None)

    return chunk_text(raw, None)


def _process_document(session: Session, payload: dict[str, Any]) -> None:
    doc_id = UUID(payload["document_id"])
    doc = session.get(Document, doc_id)
    if doc is None:
        logger.error("document_missing id=%s", doc_id)
        return

    doc.status = "processing"
    session.commit()

    try:
        raw_bytes = _download_s3_bytes(doc.s3_key)
    except ClientError:
        logger.exception("s3_download_failed doc=%s", doc_id)
        doc.status = "failed"
        session.commit()
        raise

    plan = _build_chunk_plan(doc, raw_bytes)
    if not plan:
        doc.status = "done"
        session.commit()
        return

    existing_idx = set(
        session.scalars(
            select(DocumentChunk.chunk_index).where(DocumentChunk.document_id == doc_id)
        ).all()
    )

    new_rows: list[DocumentChunk] = []
    for i, rec in enumerate(plan):
        if i in existing_idx:
            continue
        new_rows.append(
            DocumentChunk(
                document_id=doc_id,
                chunk_index=i,
                chunk_text=rec.text,
                section=rec.section,
                company_ticker=doc.company_ticker,
                doc_type=doc.doc_type,
                year=doc.year,
                quarter=doc.quarter,
                token_count=rec.token_count,
            )
        )

    batch_size = 100
    for start in range(0, len(new_rows), batch_size):
        batch = new_rows[start : start + batch_size]
        embeddings = embed_texts([r.chunk_text for r in batch])
        if len(embeddings) != len(batch):
            raise RuntimeError("embedding batch size mismatch")
        for row, emb in zip(batch, embeddings, strict=True):
            row.embedding = emb
            session.add(row)
        session.commit()

    doc.status = "done"
    session.commit()
    logger.info("ingest_ok document_id=%s chunk_count=%s", doc_id, len(plan))


def run_forever(poll_wait: int = 20) -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(level=level)
    engine = create_engine(_sync_db_url(), pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)
    sqs = _sqs_client()
    queue_url = settings.sqs_queue_url
    logger.info("worker_start queue=%s", queue_url)

    while True:
        resp = sqs.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=min(poll_wait, 20),
            VisibilityTimeout=600,
        )
        msgs = resp.get("Messages", [])
        if not msgs:
            continue
        msg = msgs[0]
        receipt = msg["ReceiptHandle"]
        body_str = msg.get("Body", "{}")
        try:
            payload = json.loads(body_str)
            with SessionLocal() as session:
                _process_document(session, payload)
            sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt)
        except Exception:
            logger.exception("ingest_failed body=%s", body_str[:500])
            try:
                doc_id = UUID(json.loads(body_str)["document_id"])
            except Exception:
                doc_id = None
            if doc_id:
                with SessionLocal() as session:
                    doc = session.get(Document, doc_id)
                    if doc:
                        doc.status = "failed"
                        session.commit()
            time.sleep(2)


if __name__ == "__main__":
    run_forever()
