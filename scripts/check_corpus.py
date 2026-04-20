#!/usr/bin/env python3
"""Validate ingested corpus (P2-15): chunk rollup, embeddings, DLQ depth.

Reads DB from DB_URL (sync URL is derived if only +asyncpg is set).
DLQ: set SQS_DLQ_URL, or rely on auto-derive when SQS_QUEUE_URL ends with
`ingestion-queue` → `ingestion-dlq`. For local ElasticMQ also set SQS_ENDPOINT_URL.

Example:
  set DB_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/copilot
  set SQS_QUEUE_URL=http://localhost:9324/000000000000/ingestion-queue
  set SQS_ENDPOINT_URL=http://localhost:9324
  python scripts/check_corpus.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import boto3
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError


def _sync_db_url(url: str) -> str:
    if "+asyncpg" in url:
        return url.replace("postgresql+asyncpg://", "postgresql://")
    return url


def derive_dlq_url(queue_url: str) -> str | None:
    q = queue_url.rstrip("/")
    if "/" not in q:
        return None
    base, name = q.rsplit("/", 1)
    if name == "ingestion-queue":
        return f"{base}/ingestion-dlq"
    return None


def run_checks(
    *,
    db_url: str,
    dlq_url: str | None,
    sqs_endpoint: str | None,
    region: str,
) -> int:
    errors: list[str] = []
    engine = create_engine(_sync_db_url(db_url), pool_pre_ping=True)

    try:
        conn_probe = engine.connect()
        conn_probe.close()
    except OperationalError as e:
        hint = (
            "RDS is in a private VPC: from your laptop use AWS SSM port forwarding, a bastion, "
            "or Client VPN. Or run this script on a host inside the VPC (e.g. ECS exec / bastion with Python)."
        )
        print(f"ERROR: cannot connect to Postgres: {e}", file=sys.stderr)
        print(hint, file=sys.stderr)
        return 2

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT company_ticker, doc_type, year, COUNT(*) AS n
                FROM document_chunks
                GROUP BY company_ticker, doc_type, year
                ORDER BY company_ticker, doc_type, year
                """
            )
        ).mappings().all()

    print("Chunk counts by (company_ticker, doc_type, year):")
    if not rows:
        print("  (no rows)")
    for r in rows:
        y = r["year"]
        y_disp = y if y is not None else "NULL"
        print(f"  {r['company_ticker']}\t{r['doc_type']}\t{y_disp}\t{r['n']}")

    with engine.connect() as conn:
        null_emb = conn.execute(
            text("SELECT COUNT(*) FROM document_chunks WHERE embedding IS NULL")
        ).scalar_one()
        total_chunks = conn.execute(text("SELECT COUNT(*) FROM document_chunks")).scalar_one()
        failed_docs = conn.execute(
            text("SELECT COUNT(*) FROM documents WHERE status = 'failed'")
        ).scalar_one()

    print()
    print(f"Total chunks: {total_chunks}")
    print(f"Chunks with NULL embedding: {null_emb}")
    print(f"Documents with status=failed: {failed_docs}")

    if null_emb:
        errors.append(f"{null_emb} chunk(s) have NULL embedding")
    if total_chunks == 0:
        errors.append("No chunks in document_chunks")

    with engine.connect() as conn:
        dims = list(
            conn.execute(
                text(
                    "SELECT DISTINCT vector_dims(embedding) AS d "
                    "FROM document_chunks WHERE embedding IS NOT NULL"
                )
            ).scalars().all()
        )

    print(f"Distinct embedding dimensions (non-null): {dims}")
    if total_chunks > 0 and null_emb == 0:
        if len(dims) != 1 or dims[0] != 1536:
            errors.append(f"Expected single dimension 1536, got {dims}")

    if dlq_url:
        kwargs: dict = {"region_name": region}
        if sqs_endpoint:
            kwargs["endpoint_url"] = sqs_endpoint
        sqs = boto3.client("sqs", **kwargs)
        try:
            attrs = sqs.get_queue_attributes(
                QueueUrl=dlq_url,
                AttributeNames=[
                    "ApproximateNumberOfMessages",
                    "ApproximateNumberOfMessagesNotVisible",
                ],
            )
            a = attrs["Attributes"]
            vis = int(a.get("ApproximateNumberOfMessages", "0"))
            inflight = int(a.get("ApproximateNumberOfMessagesNotVisible", "0"))
            print()
            print(f"DLQ ({dlq_url}): visible={vis}, in-flight={inflight}")
            if vis + inflight > 0:
                errors.append(f"DLQ not empty: visible={vis}, in-flight={inflight}")
        except Exception as e:
            errors.append(f"Could not read DLQ: {e}")
    else:
        print()
        print("DLQ: skipped (set SQS_DLQ_URL or SQS_QUEUE_URL ending in ingestion-queue)")

    if failed_docs:
        errors.append(f"{failed_docs} document(s) with status=failed")

    print()
    if errors:
        print("FAIL:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("PASS: corpus checks OK")
    return 0


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    # Prefer repo .env over inherited shell env (avoids stale DB_URL from an old SSM tunnel).
    load_dotenv(repo_root / ".env", override=True)

    p = argparse.ArgumentParser(description="Validate corpus after seeding (P2-15).")
    p.add_argument("--db-url", default=os.environ.get("DB_URL"))
    args = p.parse_args()
    if not args.db_url:
        print("ERROR: pass --db-url or set DB_URL", file=sys.stderr)
        sys.exit(2)

    region = os.environ.get("AWS_REGION", "us-east-1")
    queue_url = os.environ.get("SQS_QUEUE_URL", "")
    sqs_endpoint = os.environ.get("SQS_ENDPOINT_URL") or None
    dlq_url = os.environ.get("SQS_DLQ_URL") or (derive_dlq_url(queue_url) if queue_url else None)

    sys.exit(
        run_checks(
            db_url=args.db_url,
            dlq_url=dlq_url,
            sqs_endpoint=sqs_endpoint,
            region=region,
        )
    )


if __name__ == "__main__":
    main()
