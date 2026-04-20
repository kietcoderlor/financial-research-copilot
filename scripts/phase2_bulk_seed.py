#!/usr/bin/env python3
"""Bulk-seed Phase 2 corpus to satisfy >500 chunks and 3 doc types.

Uploads three large text objects to S3 (10-K, 10-Q, transcript), enqueues
ingestion via API, and polls each document to terminal status.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
import uuid

import boto3


def upload_text(bucket: str, key: str, body: str, *, region: str) -> None:
    boto3.client("s3", region_name=region).put_object(
        Bucket=bucket,
        Key=key,
        Body=body.encode("utf-8"),
    )


def post_ingest(api_url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/ingest",
        method="POST",
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload).encode("utf-8"),
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def get_ingest(api_url: str, doc_id: str) -> dict:
    req = urllib.request.Request(f"{api_url.rstrip('/')}/ingest/{doc_id}", method="GET")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def poll_terminal(api_url: str, doc_id: str, timeout_s: int = 2400) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        st = get_ingest(api_url, doc_id)
        if st.get("status") in ("done", "failed"):
            return st
        time.sleep(3)
    raise TimeoutError(f"document {doc_id} not terminal within {timeout_s}s")


def build_long_10k_text() -> str:
    para = (
        "Item 1. Business. The company designs software and hardware globally. "
        "Item 1A. Risk Factors. Competition, supply-chain shocks, and regulation can affect results. "
        "Item 7. Management Discussion and Analysis. Revenue, margin, and cash flow trends are discussed. "
        "Item 7A. Quantitative and Qualitative Disclosures About Market Risk. "
        "Interest-rate and foreign-exchange sensitivity are analyzed.\n\n"
    )
    return para * 3500


def build_long_10q_text() -> str:
    para = (
        "Part I Financial Information. Quarterly operations showed resilient demand and controlled costs. "
        "Risk factors remain consistent with prior filings with updates to macro uncertainty. "
        "Management's discussion addresses segment performance, liquidity, and capital allocation.\n\n"
    )
    return para * 3500


def build_long_transcript_text() -> str:
    qa_block = (
        "Operator: Welcome everyone to the earnings call.\n\n"
        "CEO: We delivered strong execution across products and services.\n\n"
        "Analyst: Can you discuss gross margin outlook and demand trends?\n\n"
        "CFO: Gross margin remained stable and operating leverage improved this quarter.\n\n"
    )
    return qa_block * 3000


def main() -> None:
    p = argparse.ArgumentParser(description="Bulk seed AWS corpus for Phase 2 DoD.")
    p.add_argument("--api-url", default=os.environ.get("API_URL", "http://localhost:8000"))
    p.add_argument("--bucket", default=os.environ.get("S3_BUCKET", "financial-copilot-raw-docs"))
    p.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    args = p.parse_args()

    docs = [
        {
            "key": f"seed/{uuid.uuid4()}/bulk_10k.txt",
            "payload": {
                "company_ticker": "AAPL",
                "doc_type": "10-K",
                "year": 2023,
                "quarter": None,
            },
            "text": build_long_10k_text(),
        },
        {
            "key": f"seed/{uuid.uuid4()}/bulk_10q.txt",
            "payload": {
                "company_ticker": "AAPL",
                "doc_type": "10-Q",
                "year": 2024,
                "quarter": 3,
            },
            "text": build_long_10q_text(),
        },
        {
            "key": f"seed/{uuid.uuid4()}/bulk_transcript.txt",
            "payload": {
                "company_ticker": "AAPL",
                "doc_type": "transcript",
                "year": 2024,
                "quarter": 3,
            },
            "text": build_long_transcript_text(),
        },
    ]

    failures = 0
    for d in docs:
        upload_text(args.bucket, d["key"], d["text"], region=args.region)
        body = {"s3_key": d["key"], **d["payload"]}
        created = post_ingest(args.api_url, body)
        doc_id = str(created["document_id"])
        status = poll_terminal(args.api_url, doc_id)
        print(json.dumps({"key": d["key"], "document_id": doc_id, "status": status}, ensure_ascii=True))
        if status.get("status") != "done":
            failures += 1

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
