from app.db.base import Base
from app.db.models import Document, DocumentChunk


def test_orm_tables_registered() -> None:
    names = {t.name for t in Base.metadata.sorted_tables}
    assert "documents" in names
    assert "document_chunks" in names


def test_document_chunk_columns_include_embedding_and_tsv() -> None:
    chunks = Base.metadata.tables["document_chunks"]
    col_names = {c.name for c in chunks.columns}
    assert "embedding" in col_names
    assert "tsv" in col_names
    assert "chunk_text" in col_names


def test_document_relationship_keyed_to_chunks() -> None:
    assert Document.chunks.property.mapper.class_ is DocumentChunk
