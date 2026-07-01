#!/usr/bin/env python3
"""Bulk ingest tickers from data/sp500_subset.csv (P7-A1, local-friendly).

Local mode (--local): uploads synthetic 10-K text to MinIO and ingests via /ingest.
Production mode: requires sec-edgar-downloader + AWS S3 (when account is restored).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.request
import uuid
from pathlib import Path

import boto3

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "sp500_subset.csv"


def upload_and_ingest(ticker: str, name: str, *, api_url: str, bucket: str, endpoint: str | None, region: str) -> None:
    from botocore.config import Config

    text = (
        f"{name} ({ticker}) Form 10-K (synthetic local seed)\n\n"
        f"Item 1A. Risk Factors.\nMacroeconomic conditions competition and regulation may affect {name}.\n\n"
        f"Item 7. MD&A.\nRevenue and operating income trends reflect sector dynamics for {ticker}."
    )
    key = f"bulk/{uuid.uuid4()}/{ticker.lower()}_10k_local.txt"
    kwargs: dict = {"region_name": region}
    if endpoint:
        kwargs["endpoint_url"] = endpoint
        kwargs["config"] = Config(s3={"addressing_style": "path"})
    s3 = boto3.client("s3", **kwargs)
    s3.put_object(Bucket=bucket, Key=key, Body=text.encode("utf-8"))

    payload = {
        "s3_key": key,
        "company_ticker": ticker,
        "company_name": name,
        "doc_type": "10-K",
        "year": 2024,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/ingest",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        doc_id = json.loads(resp.read().decode())["document_id"]

    deadline = time.time() + 300
    while time.time() < deadline:
        st_req = urllib.request.Request(f"{api_url.rstrip('/')}/ingest/{doc_id}", method="GET")
        with urllib.request.urlopen(st_req, timeout=60) as resp:
            st = json.loads(resp.read().decode())
        if st.get("status") in ("done", "failed"):
            print(ticker, st.get("status"), st.get("chunk_count", 0))
            return
        time.sleep(2)
    print(ticker, "timeout")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--local", action="store_true", help="Synthetic docs to MinIO (default path)")
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--api-url", default=os.environ.get("API_URL", "http://localhost:8000"))
    p.add_argument("--bucket", default=os.environ.get("S3_BUCKET", "financial-copilot-raw-docs"))
    p.add_argument("--s3-endpoint-url", default=os.environ.get("S3_ENDPOINT_URL", "http://localhost:9000"))
    p.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    args = p.parse_args()

    if not CSV_PATH.exists():
        print(f"Missing {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))[: args.limit]
    if not args.local:
        print("Non-local SEC download requires AWS recovery; use --local for Docker Compose.")
        sys.exit(2)

    for row in rows:
        upload_and_ingest(
            row["ticker"].strip(),
            row["company_name"].strip(),
            api_url=args.api_url,
            bucket=args.bucket,
            endpoint=args.s3_endpoint_url,
            region=args.region,
        )


if __name__ == "__main__":
    main()
