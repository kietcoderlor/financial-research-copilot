"""Helpers for retrieval filters."""

from __future__ import annotations

from app.models.requests import RetrieveFilters


def normalize_filters(filters: RetrieveFilters) -> RetrieveFilters:
    return RetrieveFilters(
        companies=[c.strip().upper() for c in filters.companies if c.strip()],
        years=sorted(set(filters.years)),
        doc_types=[d.strip() for d in filters.doc_types if d.strip()],
    )
