#!/usr/bin/env python3
"""Seed a minimal corpus (P2-14): upload 3 text objects to S3, POST /ingest, poll status.

Requires:
- API reachable (--api-url)
- IAM credentials for S3 PutObject on --bucket
- Worker consuming SQS and able to GetObject from the same bucket

Example:
  set API_URL=http://localhost:8000
  set AWS_REGION=us-east-1
  python scripts/seed_corpus.py
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


def upload_text(bucket: str, key: str, body: str, *, endpoint_url: str | None, region: str) -> None:
    kwargs: dict = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    client = boto3.client("s3", **kwargs)
    client.put_object(Bucket=bucket, Key=key, Body=body.encode("utf-8"))


def post_ingest(api_url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/ingest",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"POST /ingest failed: {e.code} {detail}") from e


def poll_status(api_url: str, doc_id: str, timeout_s: int = 900) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        req = urllib.request.Request(f"{api_url.rstrip('/')}/ingest/{doc_id}", method="GET")
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                st = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            raise
        if st.get("status") in ("done", "failed"):
            return st
        time.sleep(2)
    raise TimeoutError(f"document {doc_id} not terminal within {timeout_s}s")


def main() -> None:
    p = argparse.ArgumentParser(description="Upload seed docs and enqueue ingestion.")
    p.add_argument("--api-url", default=os.environ.get("API_URL", "http://localhost:8000"))
    p.add_argument("--bucket", default=os.environ.get("S3_BUCKET", "financial-copilot-raw-docs"))
    p.add_argument("--s3-endpoint-url", default=os.environ.get("S3_ENDPOINT_URL") or None)
    p.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    args = p.parse_args()

    docs = [
        {
            "key": f"seed/{uuid.uuid4()}/aapl_10k_sample.txt",
            "ticker": "AAPL",
            "doc_type": "10-K",
            "year": 2023,
            "quarter": None,
            "text": (
                "Item 1. Business.\n\nApple Inc. designs manufactures and markets smartphones.\n\n"
                "Item 1A. Risk Factors.\n\nCompetition may materially adversely affect the Company.\n"
            ),
        },
        {
            "key": f"seed/{uuid.uuid4()}/aapl_transcript_sample.txt",
            "ticker": "AAPL",
            "doc_type": "transcript",
            "year": 2024,
            "quarter": 3,
            "text": (
                "Operator: Welcome to the earnings call.\n\n"
                "CEO: Revenue grew year over year.\n\n"
                "Analyst: What about gross margin?\n\nCFO: Gross margin was stable.\n"
            ),
        },
        {
            "key": f"seed/{uuid.uuid4()}/brkb_letter_sample.txt",
            "ticker": "BRK.B",
            "doc_type": "letter",
            "year": 2023,
            "quarter": None,
            "text": (
                "To the shareholders of Berkshire Hathaway Inc.:\n\n"
                "Operating earnings in 2023 were strong.\n\n"
                "Charlie and I think long term.\n"
            ),
        },
    ]

    for d in docs:
        upload_text(args.bucket, d["key"], d["text"], endpoint_url=args.s3_endpoint_url, region=args.region)
        payload = {
            "s3_key": d["key"],
            "company_ticker": d["ticker"],
            "doc_type": d["doc_type"],
            "year": d["year"],
            "quarter": d["quarter"],
        }
        r = post_ingest(args.api_url, payload)
        doc_id = r["document_id"]
        st = poll_status(args.api_url, str(doc_id))
        print(d["key"], st)


if __name__ == "__main__":
    main()
