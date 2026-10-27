from __future__ import annotations

from datetime import timezone

import pytest

from app.core.csv import csv_safe
from app.core.errors import ApiError, ErrorCode
from app.core.pagination import page_offset, page_response
from app.core.roles import ADMIN_ROLES, STAFF_ROLES, WRITE_ROLES
from app.core.time import parse_optional_utc


def test_role_sets_are_single_source_of_truth():
    assert STAFF_ROLES == ("SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR")
    assert WRITE_ROLES == ("SECURITY_ADMIN", "SECURITY_ANALYST")
    assert ADMIN_ROLES == ("SECURITY_ADMIN",)


def test_csv_safe_prefixes_spreadsheet_formulas():
    assert csv_safe("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
    assert csv_safe("normal") == "normal"


def test_pagination_helpers_preserve_page_shape():
    assert page_offset(3, 25) == 50
    page = page_response(["a", "b"], total=12, page=2, page_size=10)
    assert page.model_dump() == {"items": ["a", "b"], "total": 12, "page": 2, "page_size": 10}


def test_time_parser_normalizes_utc_and_rejects_invalid_values():
    assert parse_optional_utc(None, "from_time") is None
    assert parse_optional_utc("2026-01-02T03:04:05Z", "from_time").tzinfo == timezone.utc
    with pytest.raises(ApiError) as error:
        parse_optional_utc("not-a-time", "from_time")
    assert error.value.code == ErrorCode.INVALID_TIME_FILTER
