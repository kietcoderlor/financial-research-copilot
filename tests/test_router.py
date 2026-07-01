"""Router unit tests."""

from app.retrieval.router import extract_comparison_entities, route_query


def test_route_comparison():
    assert route_query("Compare Apple vs Microsoft cloud growth") == "comparison"


def test_route_adversarial():
    assert route_query("What will happen tomorrow for fictional company xyz") == "adversarial"


def test_extract_comparison_entities():
    entities = extract_comparison_entities("Apple vs Microsoft margins in 2024")
    assert "AAPL" in entities
    assert "MSFT" in entities
