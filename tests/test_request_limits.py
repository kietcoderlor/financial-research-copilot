from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.requests import QueryRequest, RetrieveFilters


def test_query_request_question_max_length_rejected() -> None:
    with pytest.raises(ValidationError):
        QueryRequest(question="a" * 2001, filters=RetrieveFilters())

