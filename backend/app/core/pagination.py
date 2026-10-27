from __future__ import annotations

from typing import TypeVar

from app.api.schemas import Page

T = TypeVar("T")


def page_offset(page: int, page_size: int) -> int:
    return (page - 1) * page_size


def page_response(items: list[T], *, total: int, page: int, page_size: int) -> Page[T]:
    return Page(items=items, total=total, page=page, page_size=page_size)
