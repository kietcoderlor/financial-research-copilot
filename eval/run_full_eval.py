#!/usr/bin/env python3
"""Run retrieval + generation eval and update baseline (P7-C1)."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

BASELINE = Path("eval/baseline.json")
RETRIEVAL_MD = Path("eval/retrieval_scores.md")
GENERATION_MD = Path("eval/generation_scores.md")


def _parse_float(pattern: str, text: str, default: float = 0.0) -> float:
    m = re.search(pattern, text)
    if not m:
        return default
    try:
        return float(m.group(1))
    except ValueError:
        return default


def _parse_pct(pattern: str, text: str, default: float = 0.0) -> float:
    m = re.search(pattern, text)
    if not m:
        return default
    raw = m.group(1).replace("%", "")
    try:
        return float(raw) / 100.0
    except ValueError:
        return default


def main() -> None:
    subprocess.check_call([sys.executable, "eval/evaluate_retrieval.py"])
    subprocess.check_call([sys.executable, "eval/evaluate_generation.py"])

    retrieval = RETRIEVAL_MD.read_text(encoding="utf-8")
    generation = GENERATION_MD.read_text(encoding="utf-8")

    baseline = {
        "question_count": 50,
        "mean_precision_at_5": _parse_float(r"Mean Precision@5: \*\*([0-9.]+)\*\*", retrieval),
        "queries_gte_3_of_5": re.search(r">=3/5 relevant: \*\*(\d+)/(\d+)\*\*", retrieval),
        "citation_accuracy": _parse_pct(r"Citation accuracy: \*\*([0-9.]+%)\*\*", generation),
        "adversarial_refusal_rate": _parse_pct(r"Adversarial refusal rate: \*\*([0-9.]+%)\*\*", generation),
        "query_latency_p50_ms": _parse_float(r"Query latency p50: \*\*(\d+)ms\*\*", generation),
        "query_latency_p95_ms": _parse_float(r"p95: \*\*(\d+)ms\*\*", generation),
    }
    m = baseline.pop("queries_gte_3_of_5")
    if m:
        baseline["queries_gte_3_of_5"] = f"{m.group(1)}/{m.group(2)}"

    BASELINE.write_text(json.dumps(baseline, indent=2), encoding="utf-8")
    print(f"Updated {BASELINE}")
    print(json.dumps(baseline, indent=2))


if __name__ == "__main__":
    main()
