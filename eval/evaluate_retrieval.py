#!/usr/bin/env python3
"""Formal retrieval evaluation (P6-2)."""

from __future__ import annotations

import csv
import json
import os
import statistics
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

OUT = Path("eval/retrieval_scores.md")
QUESTIONS = Path("eval/questions.csv")
API_URL = os.environ.get("API_URL", "http://localhost:8000")


def sanitize_filters(filters: dict, question_type: str) -> dict:
    """Avoid 400s from unknown tickers on adversarial / empty-corpus queries."""
    if question_type == "adversarial":
        return {"companies": [], "years": [], "doc_types": []}
    return filters


def post_retrieve(query: str, filters: dict) -> dict:
    payload = json.dumps({"query": query, "filters": filters}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL.rstrip('/')}/retrieve",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        return {"chunks": [], "error": body, "status": e.code}


def label_chunk(row: dict, expected_companies: list[str], question: str) -> int:
    company = (row.get("company") or "").upper()
    text = (row.get("text") or "").lower()
    q = question.lower()
    if expected_companies and company not in {c.upper() for c in expected_companies}:
        return 0
    q_terms = [t for t in q.replace("?", "").split() if len(t) > 4]
    hits = sum(1 for t in q_terms if t in text)
    if hits >= 2:
        return 1
    if any(k in text for k in ("risk factor", "gross margin", "revenue", "cloud", "operating", "margin", "liquidity")):
        if any(k in q for k in ("risk", "margin", "revenue", "cloud", "operating", "liquidity", "regulatory")):
            return 1
    return 0


def main() -> None:
    rows = list(csv.DictReader(QUESTIONS.open(encoding="utf-8")))
    per_query: list[tuple[str, float, int, str]] = []
    by_type: dict[str, list[float]] = defaultdict(list)

    for row in rows:
        qtype = row.get("question_type") or "factual"
        filters = sanitize_filters(json.loads(row["filters"] or "{}"), qtype)
        expected = [c.strip() for c in (row.get("expected_companies") or "").split(",") if c.strip()]
        resp = post_retrieve(row["question"], filters)
        chunks = resp.get("chunks", [])[:5]
        labels = [label_chunk(c, expected, row["question"]) for c in chunks]
        p5 = sum(labels) / 5 if chunks else 0.0
        per_query.append((row["id"], p5, sum(labels), qtype))
        by_type[qtype].append(p5)

    mean_p5 = statistics.mean(p for _, p, _, _ in per_query) if per_query else 0.0
    ge3 = sum(1 for _, _, n, _ in per_query if n >= 3)

    header = [
        "# Retrieval Evaluation Scores",
        "",
        f"- API URL: `{API_URL}`",
        f"- Questions: **{len(rows)}**",
        f"- Mean Precision@5: **{mean_p5:.3f}**",
        f"- Queries with >=3/5 relevant: **{ge3}/{len(per_query)}**",
        "",
        "## By question type",
        "",
    ]
    for qtype in sorted(by_type):
        scores = by_type[qtype]
        header.append(f"- **{qtype}**: mean P@5 = {statistics.mean(scores):.3f} (n={len(scores)})")
    header.extend(["", "## Per-query results", ""])

    detail: list[str] = []
    for row_id, p5, rel, qtype in per_query:
        row = next(r for r in rows if r["id"] == row_id)
        detail.append(f"## {row_id}: {row['question']}")
        detail.append(f"- Type: `{qtype}` · Precision@5: **{p5:.2f}** ({rel}/5 relevant)")
        detail.append("")

    OUT.write_text("\n".join(header + detail), encoding="utf-8")
    print(f"Wrote {OUT} mean Precision@5={mean_p5:.3f} ({ge3}/{len(per_query)} >=3/5)")


if __name__ == "__main__":
    main()
