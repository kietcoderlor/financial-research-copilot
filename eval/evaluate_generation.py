#!/usr/bin/env python3
"""Formal generation evaluation (P6-3)."""

from __future__ import annotations

import csv
import json
import os
import re
import statistics
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path("eval/generation_scores.md")
QUESTIONS = Path("eval/questions.csv")
API_URL = os.environ.get("API_URL", "http://localhost:8000")
REFUSAL = re.compile(
    r"don't have sufficient|do not have sufficient|insufficient information|not in the (provided )?documents",
    re.I,
)


def sanitize_filters(filters: dict, question_type: str) -> dict:
    if question_type == "adversarial":
        return {"companies": [], "years": [], "doc_types": []}
    return filters


def post_query(question: str, filters: dict) -> dict:
    payload = json.dumps({"question": question, "filters": filters}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL.rstrip('/')}/query",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"answer": "", "citations": [], "error": e.read().decode(errors="replace")}


def citation_valid(resp: dict) -> bool:
    answer = resp.get("answer", "")
    citations = resp.get("citations", [])
    indices = {int(m) for m in re.findall(r"\[(\d+)\]", answer)}
    if not indices:
        return len(citations) == 0
    cited = {c["index"] for c in citations}
    return indices.issubset(cited) and all(c.get("chunk_id") for c in citations)


def main() -> None:
    rows = list(csv.DictReader(QUESTIONS.open(encoding="utf-8")))
    total = len(rows)
    citation_ok = 0
    adversarial = [r for r in rows if r.get("question_type") == "adversarial"]
    adv_refused = 0
    latencies: list[int] = []
    lines = ["# Generation Evaluation Scores", "", f"- API URL: `{API_URL}`", f"- Questions: **{total}**", ""]

    for row in rows:
        qtype = row.get("question_type") or "factual"
        filters = sanitize_filters(json.loads(row["filters"] or "{}"), qtype)
        resp = post_query(row["question"], filters)
        valid = citation_valid(resp)
        citation_ok += int(valid)
        refused = bool(REFUSAL.search(resp.get("answer", "")))
        if qtype == "adversarial" and refused:
            adv_refused += 1
        meta = resp.get("metadata") or {}
        if meta.get("total_ms"):
            latencies.append(int(meta["total_ms"]))
        lines.append(f"## {row['id']} ({qtype})")
        lines.append(f"- citation_valid: {valid}")
        lines.append(f"- refused: {refused}")
        if resp.get("error"):
            lines.append(f"- error: `{str(resp['error'])[:100]}`")
        lines.append("")

    citation_rate = citation_ok / total if total else 0.0
    adv_rate = adv_refused / len(adversarial) if adversarial else 1.0
    p50 = statistics.median(latencies) if latencies else 0
    p95 = sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)] if latencies else 0

    lines.insert(4, f"- Citation accuracy: **{citation_rate:.1%}** ({citation_ok}/{total})")
    lines.insert(5, f"- Adversarial refusal rate: **{adv_rate:.1%}** ({adv_refused}/{len(adversarial)})")
    lines.insert(6, f"- Query latency p50: **{p50}ms** · p95: **{p95}ms** (n={len(latencies)})")
    lines.insert(7, "")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(
        f"Wrote {OUT} citation={citation_rate:.1%} "
        f"adversarial_refusal={adv_rate:.1%} p50={p50}ms"
    )


if __name__ == "__main__":
    main()
