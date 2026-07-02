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


def _section_block(ticker: str, name: str, doc_type: str, idx: int) -> str:
    return (
        f"Section {idx}: {name} ({ticker}) {doc_type} analysis. "
        f"Revenue trend discussion for {ticker} covers demand, pricing actions, operating leverage, "
        f"cash flow, and margin sensitivity to macroeconomic conditions. "
        f"Risk factors include competition, regulatory pressure, FX volatility, supply-chain execution, "
        f"and technology transition risk. Management highlights near-term outlook, medium-term strategy, "
        f"capital allocation priorities, and scenario planning under stress assumptions.\n"
    )


def _build_long_text(ticker: str, name: str, doc_type: str, repeats: int) -> str:
    header = (
        f"{name} ({ticker}) {doc_type} synthetic filing for local benchmark corpus.\n\n"
        "Item 1A. Risk Factors.\n"
        "The company may be adversely affected by competition, macro conditions, regulatory change, "
        "and execution risk on product roadmap.\n\n"
        "Item 7. Management Discussion and Analysis.\n"
    )
    body = "".join(_section_block(ticker, name, doc_type, i + 1) for i in range(repeats))
    footer = (
        "\nConclusion: Management expects volatility in the next quarters while maintaining long-term "
        "investment in product, infrastructure, and risk controls."
    )
    return header + body + footer


def upload_and_ingest(
    ticker: str,
    name: str,
    *,
    api_url: str,
    bucket: str,
    endpoint: str | None,
    region: str,
    repeats: int,
    doc_type: str,
    year: int,
    quarter: int | None,
) -> tuple[str, str, int]:
    from botocore.config import Config

    text = _build_long_text(ticker, name, doc_type, repeats)
    key = f"bulk/{uuid.uuid4()}/{ticker.lower()}_{doc_type.lower().replace('-', '')}_{year}_local.txt"
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
        "doc_type": doc_type,
        "year": year,
        "quarter": quarter,
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
            chunk_count = int(st.get("chunk_count", 0))
            print(ticker, doc_type, year, st.get("status"), chunk_count)
            return str(st.get("status")), doc_type, chunk_count
        time.sleep(2)
    print(ticker, doc_type, year, "timeout", 0)
    return "timeout", doc_type, 0


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--local", action="store_true", help="Synthetic docs to MinIO (default path)")
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--repeats", type=int, default=24, help="Section repeats per synthetic document")
    p.add_argument(
        "--doc-types",
        default="10-K,10-Q,transcript",
        help="Comma-separated doc types to generate per ticker",
    )
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

    doc_types = [d.strip() for d in args.doc_types.split(",") if d.strip()]
    total_docs = 0
    total_chunks = 0
    failed = 0

    for row in rows:
        ticker = row["ticker"].strip()
        name = row["company_name"].strip()
        for doc_type in doc_types:
            year = 2024 if doc_type != "10-K" else 2023
            quarter = 3 if doc_type in ("10-Q", "transcript") else None
            status, _, chunk_count = upload_and_ingest(
                ticker,
                name,
                api_url=args.api_url,
                bucket=args.bucket,
                endpoint=args.s3_endpoint_url,
                region=args.region,
                repeats=args.repeats,
                doc_type=doc_type,
                year=year,
                quarter=quarter,
            )
            total_docs += 1
            total_chunks += chunk_count
            if status != "done":
                failed += 1

    print(
        f"Bulk ingest complete: tickers={len(rows)} docs={total_docs} "
        f"chunks={total_chunks} failed_docs={failed}"
    )


if __name__ == "__main__":
    main()
