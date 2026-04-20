"""documents + document_chunks + indexes (P2-1, P2-2).

Revision ID: p2_batch1_001
Revises:
Create Date: 2026-04-20
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.schema import Computed

revision = "p2_batch1_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("s3_key", sa.Text(), nullable=False),
        sa.Column("company_ticker", sa.String(length=16), nullable=False),
        sa.Column("company_name", sa.String(length=256), nullable=True),
        sa.Column("doc_type", sa.String(length=64), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("quarter", sa.Integer(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "document_chunks",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column(
            "tsv",
            TSVECTOR(),
            Computed("to_tsvector('english', coalesce(chunk_text, ''))", persisted=True),
            nullable=False,
        ),
        sa.Column("section", sa.String(length=128), nullable=True),
        sa.Column("company_ticker", sa.String(length=16), nullable=False),
        sa.Column("doc_type", sa.String(length=64), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("quarter", sa.Integer(), nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_document_chunk_index"),
    )
    op.create_index(op.f("ix_document_chunks_document_id"), "document_chunks", ["document_id"], unique=False)

    op.execute(
        """
        CREATE INDEX ix_document_chunks_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )
    op.execute(
        """
        CREATE INDEX ix_document_chunks_tsv_gin
        ON document_chunks
        USING GIN (tsv);
        """
    )
    op.create_index(
        "ix_document_chunks_company_year_quarter_type",
        "document_chunks",
        ["company_ticker", "year", "quarter", "doc_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_document_chunks_company_year_quarter_type", table_name="document_chunks")
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_tsv_gin")
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding_hnsw")
    op.drop_index(op.f("ix_document_chunks_document_id"), table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_table("documents")
