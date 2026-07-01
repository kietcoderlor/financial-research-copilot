#!/usr/bin/env python3
"""Local dev seed (INFRA-4): upload synthetic financial docs to MinIO and ingest.

Requires Docker Compose stack with api, worker, minio, elasticmq running.

Example (from host):
  set API_URL=http://localhost:8000
  set S3_ENDPOINT_URL=http://localhost:9000
  set AWS_ACCESS_KEY_ID=minioadmin
  set AWS_SECRET_ACCESS_KEY=minioadmin
  python scripts/seed_local.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import boto3

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "local_seed_manifest.json"


def upload_text(bucket: str, key: str, body: str, *, endpoint_url: str | None, region: str) -> None:
    from botocore.config import Config

    kwargs: dict = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
        kwargs["config"] = Config(s3={"addressing_style": "path"})
    client = boto3.client("s3", **kwargs)
    client.put_object(Bucket=bucket, Key=key, Body=body.encode("utf-8"))


def ensure_bucket(bucket: str, *, endpoint_url: str | None, region: str) -> None:
    from botocore.config import Config
    from botocore.exceptions import ClientError

    kwargs: dict = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
        kwargs["config"] = Config(s3={"addressing_style": "path"})
    client = boto3.client("s3", **kwargs)
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError:
        client.create_bucket(Bucket=bucket)


def post_ingest(api_url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/ingest",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


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


def wait_for_api(api_url: str, timeout_s: int = 120) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{api_url.rstrip('/')}/health", timeout=5) as resp:
                if resp.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2)
    raise TimeoutError(f"API not healthy at {api_url}")


def main() -> None:
    api_url = os.environ.get("API_URL", "http://localhost:8000")
    bucket = os.environ.get("S3_BUCKET", "financial-copilot-raw-docs")
    endpoint = os.environ.get("S3_ENDPOINT_URL", "http://localhost:9000")
    region = os.environ.get("AWS_REGION", "us-east-1")

    if not MANIFEST.exists():
        print(f"Missing manifest: {MANIFEST}", file=sys.stderr)
        sys.exit(1)

    docs = json.loads(MANIFEST.read_text(encoding="utf-8"))
    print(f"Waiting for API at {api_url}...")
    wait_for_api(api_url)
    ensure_bucket(bucket, endpoint_url=endpoint, region=region)

    ok = 0
    for d in docs:
        key = f"local/{uuid.uuid4()}/{d['filename']}"
        upload_text(bucket, key, d["text"], endpoint_url=endpoint, region=region)
        payload = {
            "s3_key": key,
            "company_ticker": d["ticker"],
            "company_name": d.get("company_name"),
            "doc_type": d["doc_type"],
            "year": d["year"],
            "quarter": d.get("quarter"),
        }
        r = post_ingest(api_url, payload)
        st = poll_status(api_url, str(r["document_id"]))
        print(d["ticker"], d["doc_type"], d["year"], st.get("status"), st.get("chunk_count", 0))
        if st.get("status") == "done":
            ok += 1

    print(f"Seeded {ok}/{len(docs)} documents.")


if __name__ == "__main__":
    main()
