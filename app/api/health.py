from __future__ import annotations

import asyncio

import boto3
from fastapi import APIRouter
from redis import Redis
from sqlalchemy import text

from app.core.config import settings
from app.db.session import AsyncSessionLocal

from app.models.responses import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    dependencies: dict[str, str] = {
        "db": "unknown",
        "redis": "unknown",
        "aws": "unknown",
    }

    # DB
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        dependencies["db"] = "ok"
    except Exception:
        dependencies["db"] = "error"

    # Redis
    try:
        await asyncio.to_thread(lambda: Redis.from_url(settings.redis_url, decode_responses=True).ping())
        dependencies["redis"] = "ok"
    except Exception:
        dependencies["redis"] = "error"

    # AWS (best-effort): only check if queue URL exists
    try:
        if settings.sqs_queue_url:
            sqs = boto3.client("sqs", region_name=settings.aws_region, endpoint_url=settings.resolved_sqs_endpoint_url)
            await asyncio.to_thread(
                lambda: sqs.get_queue_attributes(
                    QueueUrl=settings.sqs_queue_url,
                    AttributeNames=["ApproximateNumberOfMessages"],
                )
            )
            dependencies["aws"] = "ok"
        else:
            dependencies["aws"] = "unknown"
    except Exception:
        dependencies["aws"] = "error"

    degraded = any(v == "error" for v in dependencies.values())
    return HealthResponse(
        status="degraded" if degraded else "ok",
        version="0.1.0",
        degraded=degraded,
        dependencies=dependencies,
    )
