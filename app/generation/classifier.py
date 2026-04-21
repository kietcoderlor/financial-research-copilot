"""Simple query-type classifier for prompt shaping."""

from __future__ import annotations


def classify_query(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ("compare", " vs ", " versus ")):
        return "comparison"
    if any(k in q for k in ("bull case", "bear case", "bullish", "bearish")):
        return "bull_bear"
    if any(k in q for k in ("apple", "aapl", "microsoft", "msft", "company")):
        return "single_company"
    return "general"


def query_type_instructions(query_type: str) -> str:
    if query_type == "comparison":
        return "Focus on contrasts and trade-offs across entities."
    if query_type == "bull_bear":
        return "Provide balanced upside and downside arguments grounded in context."
    if query_type == "single_company":
        return "Focus on one company and avoid cross-company speculation."
    return "Provide a concise, document-grounded synthesis."
