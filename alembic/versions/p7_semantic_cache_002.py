"""Add semantic cache table (P7-B7)."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "p7_semantic_cache_002"
down_revision = "p2_batch1_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cached_query_responses",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("query_embedding", Vector(1536), nullable=False),
        sa.Column("filters_hash", sa.String(length=64), nullable=False),
        sa.Column("response_json", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_cached_query_responses_filters_hash", "cached_query_responses", ["filters_hash"])
    op.execute(
        """
        CREATE INDEX ix_cached_query_responses_embedding_hnsw
        ON cached_query_responses
        USING hnsw (query_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_cached_query_responses_embedding_hnsw")
    op.drop_index("ix_cached_query_responses_filters_hash", table_name="cached_query_responses")
    op.drop_table("cached_query_responses")
