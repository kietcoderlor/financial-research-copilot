"""SQS helpers for ingestion."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import boto3

from app.core.config import settings


def _sqs_client():
    kwargs: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.resolved_sqs_endpoint_url:
        kwargs["endpoint_url"] = settings.resolved_sqs_endpoint_url
    return boto3.client("sqs", **kwargs)


def send_ingest_message(
    *,
    document_id: UUID,
    s3_key: str,
    company_ticker: str,
    company_name: str | None,
    doc_type: str,
    year: int | None,
    quarter: int | None,
) -> None:
    body = {
        "document_id": str(document_id),
        "s3_key": s3_key,
        "company_ticker": company_ticker,
        "company_name": company_name,
        "doc_type": doc_type,
        "year": year,
        "quarter": quarter,
    }
    _sqs_client().send_message(
        QueueUrl=settings.sqs_queue_url,
        MessageBody=json.dumps(body),
    )
