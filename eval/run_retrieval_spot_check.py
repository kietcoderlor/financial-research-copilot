#!/usr/bin/env python3
"""Phase 3.9 retrieval spot-check with heuristic grading."""

from __future__ import annotations

import json
import os
import statistics
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


API_URL = os.environ.get(
    "API_URL",
    "http://financial-copilot-alb-133191467.us-east-1.elb.amazonaws.com",
)
OUT_MD = Path("eval/retrieval_results.md")


@dataclass(slots=True)
class EvalQuery:
    query: str
    filters: dict[str, Any]
    expected_company: str
    expected_doc_type: str | None = None
    expected_year: int | None = None
    topic_keywords: tuple[str, ...] = ()


QUERIES: list[EvalQuery] = [
    EvalQuery(
        query="Apple risk factors 2024",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": []},
        expected_company="AAPL",
        expected_year=2024,
        topic_keywords=("risk", "factor", "competition", "uncertainty"),
    ),
    EvalQuery(
        query="Apple management discussion on revenue trends",
        filters={"companies": ["AAPL"], "years": [2023, 2024], "doc_types": ["10-K", "10-Q"]},
        expected_company="AAPL",
        topic_keywords=("revenue", "management", "discussion", "trend"),
    ),
    EvalQuery(
        query="Apple quantitative disclosures market risk",
        filters={"companies": ["AAPL"], "years": [2023, 2024], "doc_types": ["10-K", "10-Q"]},
        expected_company="AAPL",
        topic_keywords=("market risk", "quantitative", "interest-rate", "fx"),
    ),
    EvalQuery(
        query="Apple prepared remarks earnings call",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]},
        expected_company="AAPL",
        expected_doc_type="transcript",
        expected_year=2024,
        topic_keywords=("operator", "ceo", "earnings", "margin"),
    ),
    EvalQuery(
        query="Apple gross margin analyst question",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]},
        expected_company="AAPL",
        expected_doc_type="transcript",
        expected_year=2024,
        topic_keywords=("analyst", "gross margin", "cfo"),
    ),
    EvalQuery(
        query="Apple business overview devices services",
        filters={"companies": ["AAPL"], "years": [2023], "doc_types": ["10-K"]},
        expected_company="AAPL",
        expected_doc_type="10-K",
        expected_year=2023,
        topic_keywords=("business", "devices", "services", "globally"),
    ),
    EvalQuery(
        query="Apple 2024 quarterly liquidity and capital allocation",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["10-Q"]},
        expected_company="AAPL",
        expected_doc_type="10-Q",
        expected_year=2024,
        topic_keywords=("liquidity", "capital", "allocation", "quarterly"),
    ),
    EvalQuery(
        query="Apple section on risk factors from 10-K only",
        filters={"companies": ["AAPL"], "years": [2023], "doc_types": ["10-K"]},
        expected_company="AAPL",
        expected_doc_type="10-K",
        expected_year=2023,
        topic_keywords=("risk", "factors"),
    ),
    EvalQuery(
        query="Apple section on risk factors from 10-Q only",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["10-Q"]},
        expected_company="AAPL",
        expected_doc_type="10-Q",
        expected_year=2024,
        topic_keywords=("risk", "factors"),
    ),
    EvalQuery(
        query="Apple transcript comments on operating leverage",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]},
        expected_company="AAPL",
        expected_doc_type="transcript",
        expected_year=2024,
        topic_keywords=("operating leverage", "margin"),
    ),
    EvalQuery(
        query="Apple 2023 market risk disclosures",
        filters={"companies": ["AAPL"], "years": [2023], "doc_types": ["10-K"]},
        expected_company="AAPL",
        expected_doc_type="10-K",
        expected_year=2023,
        topic_keywords=("market risk", "quantitative"),
    ),
    EvalQuery(
        query="Apple 2024 filing discussion on macro uncertainty",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["10-Q"]},
        expected_company="AAPL",
        expected_doc_type="10-Q",
        expected_year=2024,
        topic_keywords=("uncertainty", "macro", "risk"),
    ),
    EvalQuery(
        query="Apple earnings transcript demand trends by segment",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]},
        expected_company="AAPL",
        expected_doc_type="transcript",
        expected_year=2024,
        topic_keywords=("demand", "segment", "analyst"),
    ),
    EvalQuery(
        query="Apple filings with management discussion and analysis",
        filters={"companies": ["AAPL"], "years": [2023, 2024], "doc_types": ["10-K", "10-Q"]},
        expected_company="AAPL",
        topic_keywords=("management", "analysis", "revenue"),
    ),
    EvalQuery(
        query="Apple transcript references to stable gross margin",
        filters={"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]},
        expected_company="AAPL",
        expected_doc_type="transcript",
        expected_year=2024,
        topic_keywords=("stable", "gross margin", "cfo"),
    ),
]


def call_retrieve(query: str, filters: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps({"query": query, "filters": filters}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL.rstrip('/')}/retrieve",
        method="POST",
        headers={"Content-Type": "application/json"},
        data=body,
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def label_chunk(q: EvalQuery, chunk: dict[str, Any]) -> str:
    text = (chunk.get("text") or "").lower()
    company_ok = chunk.get("company") == q.expected_company
    year_ok = q.expected_year is None or chunk.get("year") == q.expected_year
    doc_ok = q.expected_doc_type is None or chunk.get("doc_type") == q.expected_doc_type
    keyword_ok = any(k.lower() in text for k in q.topic_keywords) if q.topic_keywords else True

    if company_ok and year_ok and doc_ok and keyword_ok:
        return "Relevant"
    if company_ok and (year_ok or doc_ok):
        return "Partial"
    return "Not Relevant"


def main() -> None:
    details: list[str] = []
    p5_scores: list[float] = []
    query_relevant_hits = 0

    for idx, q in enumerate(QUERIES, start=1):
        resp = call_retrieve(q.query, q.filters)
        chunks = resp.get("chunks", [])[:5]
        labels = [label_chunk(q, c) for c in chunks]
        relevant_count = sum(1 for l in labels if l == "Relevant")
        precision_at_5 = relevant_count / 5.0
        p5_scores.append(precision_at_5)
        if relevant_count >= 3:
            query_relevant_hits += 1

        details.append(f"### Q{idx}: {q.query}")
        details.append("")
        details.append(f"- Filters: `{json.dumps(q.filters, ensure_ascii=True)}`")
        details.append(f"- Precision@5 (heuristic): **{precision_at_5:.2f}**")
        details.append("")
        details.append("| Rank | Company | Doc Type | Year | Score | Label | Excerpt |")
        details.append("|---|---|---|---:|---:|---|---|")
        for rank, (chunk, label) in enumerate(zip(chunks, labels, strict=True), start=1):
            excerpt = (chunk.get("text") or "").replace("\n", " ").strip()
            excerpt = (excerpt[:180] + "...") if len(excerpt) > 180 else excerpt
            details.append(
                f"| {rank} | {chunk.get('company')} | {chunk.get('doc_type')} | "
                f"{chunk.get('year')} | {chunk.get('score', 0):.4f} | {label} | {excerpt} |"
            )
        details.append("")

    mean_p5 = statistics.fmean(p5_scores) if p5_scores else 0.0
    summary_lines = [
        "# Retrieval Spot Check Results (Heuristic)",
        "",
        f"- API URL: `{API_URL}`",
        f"- Query count: **{len(QUERIES)}**",
        f"- Mean Precision@5 (heuristic): **{mean_p5:.3f}**",
        f"- Queries with >=3/5 Relevant: **{query_relevant_hits}/{len(QUERIES)}**",
        "",
        "> Note: labels are heuristic (`Relevant`/`Partial`/`Not Relevant`) and can be manually adjusted.",
        "",
        "## Per-query details",
        "",
    ]
    OUT_MD.write_text("\n".join(summary_lines + details), encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Mean Precision@5 (heuristic): {mean_p5:.3f}")


if __name__ == "__main__":
    main()
