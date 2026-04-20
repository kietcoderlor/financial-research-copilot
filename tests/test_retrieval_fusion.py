from uuid import uuid4

from app.retrieval.fusion import rrf_fuse
from app.retrieval.types import ChunkResult


def _chunk(score: float) -> ChunkResult:
    return ChunkResult(
        id=uuid4(),
        text="t",
        company="AAPL",
        doc_type="10-K",
        year=2024,
        section="risk_factors",
        score=score,
    )


def test_rrf_fuse_deduplicates_and_limits() -> None:
    a = _chunk(0.9)
    b = _chunk(0.8)
    c = _chunk(0.7)
    fused = rrf_fuse([a, b], [a, c], limit=3)
    ids = [x.id for x in fused]
    assert len(ids) == len(set(ids))
    assert len(fused) == 3


def test_rrf_fuse_prefers_high_combined_rank() -> None:
    top_vec = _chunk(0.9)
    top_bm25 = _chunk(0.8)
    shared = _chunk(0.5)
    fused = rrf_fuse([shared, top_vec], [shared, top_bm25], limit=3)
    assert fused[0].id == shared.id
