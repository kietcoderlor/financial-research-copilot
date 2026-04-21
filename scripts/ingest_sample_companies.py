#!/usr/bin/env python3
"""Upload sample plain-text docs for extra tickers and enqueue ingestion (AWS).

Uses the same flow as seed_corpus.py: S3 PutObject -> POST /ingest -> poll status.

Avoid doc_type "letter" for plain .txt uploads: the worker treats "letter" as PDF. Use "10-K",
"10-Q", or "transcript" for UTF-8 text unless the object is a real PDF.

Example:
  set API_URL=http://<alb>/...
  set S3_BUCKET=financial-copilot-raw-docs-...
  python scripts/ingest_sample_companies.py
"""

from __future__ import annotations

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
        with urllib.request.urlopen(req, timeout=60) as resp:
            st = json.loads(resp.read().decode())
        if st.get("status") in ("done", "failed"):
            return st
        time.sleep(2)
    raise TimeoutError(f"document {doc_id} not terminal within {timeout_s}s")


def main() -> None:
    api_url = os.environ.get("API_URL", "http://localhost:8000").rstrip("/")
    bucket = os.environ.get("S3_BUCKET", "financial-copilot-raw-docs")
    region = os.environ.get("AWS_REGION", "us-east-1")
    s3_endpoint = os.environ.get("S3_ENDPOINT_URL") or None

    # Use plain-text-friendly doc types. "letter" is routed through the PDF parser in the worker and will fail on .txt.
    docs: list[dict] = [
        {
            "ticker": "BRK.B",
            "doc_type": "10-K",
            "year": 2023,
            "quarter": None,
            "text": (
                "Item 1A. Risk Factors — Berkshire Hathaway Inc. (BRK.B).\n\n"
                "Insurance underwriting results may be volatile due to catastrophes and litigation.\n\n"
                "Equity and derivative exposures could produce significant quarterly swings in reported earnings.\n"
                "Regulatory and tax changes may affect railroad, utility, and manufacturing subsidiaries.\n"
            ),
        },
        {
            "ticker": "BRK.A",
            "doc_type": "10-K",
            "year": 2023,
            "quarter": None,
            "text": (
                "Item 1A. Risk Factors — Berkshire Hathaway Inc. (BRK.A).\n\n"
                "Concentration of operating results in a subset of large subsidiaries increases exposure to sector shocks.\n\n"
                "Capital-intensive businesses face inflation in labor, materials, and energy costs.\n"
                "Repurchase activity depends on market prices and internal liquidity needs.\n"
            ),
        },
        {
            "ticker": "MSFT",
            "doc_type": "10-K",
            "year": 2024,
            "quarter": None,
            "text": (
                "Item 1A. Risk Factors — Microsoft Corporation (MSFT).\n\n"
                "Cybersecurity incidents could materially affect operations and customer trust.\n\n"
                "Competition in cloud services may pressure margins and growth rates.\n"
                "Regulatory scrutiny in multiple jurisdictions may limit product distribution or increase compliance cost.\n"
            ),
        },
    ]

    for d in docs:
        key = f"seed/{uuid.uuid4()}/{d['ticker'].lower().replace('.', '_')}_sample.txt"
        upload_text(bucket, key, d["text"], endpoint_url=s3_endpoint, region=region)
        payload = {
            "s3_key": key,
            "company_ticker": d["ticker"],
            "company_name": None,
            "doc_type": d["doc_type"],
            "year": d["year"],
            "quarter": d["quarter"],
            "source_url": None,
        }
        r = post_ingest(api_url, payload)
        doc_id = r["document_id"]
        st = poll_status(api_url, str(doc_id))
        print(f"{d['ticker']} {key} -> {st}")


if __name__ == "__main__":
    main()
