#!/usr/bin/env python3
"""Reliable Phase 2 seeding run for AWS.

Creates many medium-sized objects across 3 doc types (10-K, 10-Q, transcript),
enqueues them via API, and waits each document to terminal status.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.request
import uuid
from pathlib import Path

import boto3


def upload_text(bucket: str, key: str, body: str, *, region: str) -> None:
    boto3.client("s3", region_name=region).put_object(
        Bucket=bucket, Key=key, Body=body.encode("utf-8")
    )


def post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def poll_status(api_url: str, doc_id: str, timeout_s: int = 1200) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        st = get_json(f"{api_url.rstrip('/')}/ingest/{doc_id}")
        if st.get("status") in ("done", "failed"):
            return st
        time.sleep(2)
    raise TimeoutError(f"timeout waiting document_id={doc_id}")


def transcript_text(base: str) -> str:
    block = (
        "Operator: Welcome to the earnings call.\n\n"
        "CEO: Revenue grew with better product mix and services attach rates.\n\n"
        "Analyst: Can you discuss gross margin and demand trends by segment?\n\n"
        "CFO: Margin remained stable and we saw improving operating leverage.\n\n"
    )
    return (block * 120) + "\n" + (base * 5)


def filing_text(base: str, filing_label: str) -> str:
    sec = (
        f"{filing_label} Item 1 Business. The company operates globally across devices, software and services.\n\n"
        f"{filing_label} Item 1A Risk Factors. Competition and macro conditions may affect growth.\n\n"
        f"{filing_label} Item 7 MD&A. Management discusses revenue, gross margin, and cash flow trends.\n\n"
        f"{filing_label} Item 7A Quantitative disclosures. Interest-rate and FX sensitivity are monitored.\n\n"
    )
    return (sec * 180) + "\n" + (base * 5)


def main() -> None:
    p = argparse.ArgumentParser(description="Finalize Phase 2 corpus seeding.")
    p.add_argument("--api-url", default=os.environ.get("API_URL", "http://localhost:8000"))
    p.add_argument("--bucket", default=os.environ.get("S3_BUCKET", "financial-copilot-raw-docs"))
    p.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    p.add_argument("--count", type=int, default=24, help="documents to ingest in this run")
    args = p.parse_args()

    base = Path("doc/developer-tasks.md").read_text(encoding="utf-8", errors="replace")
    failures = 0
    done = 0
    total_chunks = 0

    for i in range(args.count):
        mod = i % 3
        if mod == 0:
            doc_type = "10-K"
            text = filing_text(base, "Form 10-K")
        elif mod == 1:
            doc_type = "10-Q"
            text = filing_text(base, "Form 10-Q")
        else:
            doc_type = "transcript"
            text = transcript_text(base)

        key = f"seed/final-phase2/{uuid.uuid4()}/{doc_type.lower()}_{i}.txt"
        upload_text(args.bucket, key, text, region=args.region)
        payload = {
            "s3_key": key,
            "company_ticker": "AAPL",
            "doc_type": doc_type,
            "year": 2024 if doc_type != "10-K" else 2023,
            "quarter": 3 if doc_type in ("10-Q", "transcript") else None,
        }
        created = post_json(f"{args.api_url.rstrip('/')}/ingest", payload)
        doc_id = str(created["document_id"])
        st = poll_status(args.api_url, doc_id)
        chunks = int(st.get("chunk_count", 0))
        if st.get("status") == "done":
            done += 1
            total_chunks += chunks
        else:
            failures += 1
        print(
            json.dumps(
                {
                    "i": i,
                    "doc_type": doc_type,
                    "document_id": doc_id,
                    "status": st.get("status"),
                    "chunk_count": chunks,
                },
                ensure_ascii=True,
            ),
            flush=True,
        )

    print(
        json.dumps(
            {"done_docs": done, "failed_docs": failures, "total_new_chunks": total_chunks},
            ensure_ascii=True,
        )
    )
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
