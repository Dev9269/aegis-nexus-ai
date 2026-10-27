from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Sequence

from fastapi import Response


def csv_safe(value: object) -> str:
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(("=", "+", "-", "@")) else text


def csv_download(
    *, headers: Sequence[str], rows: Iterable[Sequence[object]], filename: str, correlation_id: str
) -> Response:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([csv_safe(value) for value in row])
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Correlation-ID": correlation_id,
        },
    )
