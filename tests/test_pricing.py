"""Pricing helper tests."""

from app.core.pricing import compute_llm_cost_usd


def test_compute_llm_cost():
    cost = compute_llm_cost_usd("claude-sonnet-4-5", 1_000_000, 1_000_000)
    assert cost == 18.0
