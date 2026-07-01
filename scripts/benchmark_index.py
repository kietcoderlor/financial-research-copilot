#!/usr/bin/env python3
"""Benchmark vector index latency/recall proxy (P7-A3)."""

from __future__ import annotations

import json
import os
import statistics
import time
import urllib.request

API_URL = os.environ.get("API_URL", "http://localhost:8000")
QUERIES = [
    "Apple risk factors",
    "Microsoft Azure growth",
    "Tesla margin guidance",
    "Google Cloud revenue",
    "Goldman Sachs risk factors",
]


def retrieve(query: str) -> dict:
    payload = json.dumps({"query": query, "filters": {}}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL.rstrip('/')}/retrieve",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    latencies: list[int] = []
    recalls: list[int] = []
    for q in QUERIES:
        t0 = time.perf_counter()
        resp = retrieve(q)
        latencies.append(int((time.perf_counter() - t0) * 1000))
        recalls.append(len(resp.get("chunks", [])))
    print("queries", len(QUERIES))
    print("p50_ms", statistics.median(latencies))
    print("p95_ms", sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)])
    print("avg_chunks_returned", statistics.mean(recalls))


if __name__ == "__main__":
    main()
