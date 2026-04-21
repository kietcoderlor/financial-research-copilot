from app.generation.citation_parser import extract_citation_indices, resolve_citations
from app.generation.classifier import classify_query
from app.generation.context_builder import build_context
from app.retrieval.types import ChunkResult


def _chunk(i: int) -> ChunkResult:
    return ChunkResult(
        id=__import__("uuid").uuid4(),
        text=f"chunk {i} text",
        company="AAPL",
        doc_type="10-K",
        year=2024,
        section="risk_factors",
        score=1.0 / i,
    )


def test_classify_query_paths() -> None:
    assert classify_query("Compare AAPL vs MSFT") == "comparison"
    assert classify_query("What is the bull case for Apple?") == "bull_bear"
    assert classify_query("Apple risk factors") == "single_company"
    assert classify_query("Macro outlook") == "general"


def test_citation_extract_and_resolve() -> None:
    indices = extract_citation_indices("Answer [1] and [2, 3].")
    assert indices == [1, 2, 3]
    chunks = [_chunk(1), _chunk(2)]
    resolved = resolve_citations(indices, chunks)
    assert [i for i, _ in resolved] == [1, 2]


def test_context_builder_keeps_blocks() -> None:
    ctx, kept = build_context([_chunk(1), _chunk(2)])
    assert "[1] Company: AAPL" in ctx
    assert "[2] Company: AAPL" in ctx
    assert len(kept) == 2
