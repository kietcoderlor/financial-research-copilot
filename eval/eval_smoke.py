#!/usr/bin/env python3
"""Fast smoke checks for eval assets on CI."""

from __future__ import annotations

import json
from pathlib import Path

BASELINE = Path("eval/baseline.json")
REQUIRED_KEYS = {
    "question_count",
    "mean_precision_at_5",
    "queries_gte_3_of_5",
    "citation_accuracy",
    "adversarial_refusal_rate",
    "query_latency_p50_ms",
    "query_latency_p95_ms",
}


def main() -> None:
    if not BASELINE.exists():
        raise SystemExit("Missing eval/baseline.json")
    payload = json.loads(BASELINE.read_text(encoding="utf-8"))
    missing = sorted(REQUIRED_KEYS - set(payload))
    if missing:
        raise SystemExit(f"baseline.json missing keys: {', '.join(missing)}")

    if float(payload["mean_precision_at_5"]) < 0:
        raise SystemExit("mean_precision_at_5 must be non-negative")
    if not str(payload["queries_gte_3_of_5"]).count("/"):
        raise SystemExit("queries_gte_3_of_5 should be ratio format (e.g. 29/50)")

    print("Eval smoke check passed.")


if __name__ == "__main__":
    main()

