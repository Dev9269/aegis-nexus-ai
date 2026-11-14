"""Minimal, dependency-free PDF writer.

Produces a valid single-font-family (Helvetica) multi-page PDF from a list of
styled text blocks. Intentionally tiny: no external libraries, no compression,
WinAnsi encoding so common punctuation renders correctly.
"""

from __future__ import annotations

import io

PAGE_W = 595
PAGE_H = 842
MARGIN = 56
CONTENT_W = PAGE_W - 2 * MARGIN

# kind -> (font_key, font_size, line_height)
_STYLES: dict[str, tuple[str | None, float, float]] = {
    "title": ("F2", 20.0, 27.0),
    "h2": ("F2", 13.0, 19.0),
    "body": ("F1", 10.5, 15.0),
    "bullet": ("F1", 10.5, 15.0),
    "kv": ("F1", 10.5, 15.0),
    "note": ("F1", 9.0, 12.5),
    "spacer": (None, 0.0, 9.0),
}

Block = tuple[str, str]


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _wrap(text: str, max_chars: int) -> list[str]:
    lines: list[str] = []
    for raw in text.split("\n"):
        if raw == "":
            lines.append("")
            continue
        words = raw.split(" ")
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if len(candidate) <= max_chars:
                current = candidate
            else:
                if current:
                    lines.append(current)
                while len(word) > max_chars:
                    lines.append(word[:max_chars])
                    word = word[max_chars:]
                current = word
        lines.append(current)
    return lines


def _build_pdf(pages: list[bytes]) -> bytes:
    n = len(pages)
    font1_obj = 3
    font2_obj = 4
    first_page_obj = 5
    page_objs = [first_page_obj + 2 * i for i in range(n)]
    content_objs = [first_page_obj + 2 * i + 1 for i in range(n)]

    objs: dict[int, bytes] = {}
    objs[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    kids = " ".join(f"{obj} 0 R" for obj in page_objs)
    objs[2] = f"<< /Type /Pages /Kids [{kids}] /Count {n} >>".encode("ascii")
    objs[font1_obj] = (
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica "
        b"/Encoding /WinAnsiEncoding >>"
    )
    objs[font2_obj] = (
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold "
        b"/Encoding /WinAnsiEncoding >>"
    )
    for i, content in enumerate(pages):
        page_obj = page_objs[i]
        content_obj = content_objs[i]
        objs[page_obj] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Resources << /Font << /F1 {font1_obj} 0 R /F2 {font2_obj} 0 R >> >> "
            f"/Contents {content_obj} 0 R >>"
        ).encode("ascii")
        objs[content_obj] = (
            b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n"
            + content + b"\nendstream"
        )

    max_obj = max(objs)
    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0] * (max_obj + 1)
    for num in range(1, max_obj + 1):
        offsets[num] = buf.tell()
        buf.write(f"{num} 0 obj\n".encode("ascii"))
        buf.write(objs[num])
        buf.write(b"\nendobj\n")

    xref_pos = buf.tell()
    buf.write(f"xref\n0 {max_obj + 1}\n".encode("ascii"))
    buf.write(b"0000000000 65535 f \n")
    for num in range(1, max_obj + 1):
        buf.write(f"{offsets[num]:010d} 00000 n \n".encode("ascii"))
    buf.write(
        f"trailer\n<< /Size {max_obj + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode(
            "ascii"
        )
    )
    return buf.getvalue()


def render_pdf(blocks: list[Block]) -> bytes:
    pages: list[bytes] = []
    ops: list[str] = []
    y = float(PAGE_H - MARGIN)

    def flush_page() -> None:
        nonlocal ops, y
        pages.append("".join(ops).encode("cp1252", "replace"))
        ops = []
        y = float(PAGE_H - MARGIN)

    for kind, text in blocks:
        font, size, line_height = _STYLES.get(kind, _STYLES["body"])
        if kind == "spacer":
            y -= line_height
            if y < MARGIN:
                flush_page()
            continue
        assert font is not None
        max_chars = max(12, int(CONTENT_W / (0.5 * size)))
        lines = _wrap(text, max_chars) or [""]
        indent = 14.0 if kind == "bullet" else 0.0
        x = MARGIN + indent
        for index, line in enumerate(lines):
            if y - line_height < MARGIN:
                flush_page()
            prefix = "\u2022  " if (kind == "bullet" and index == 0) else ""
            ops.append(
                f"BT /{font} {size} Tf {x:.1f} {y:.2f} Td "
                f"({_escape(prefix + line)}) Tj ET\n"
            )
            y -= line_height

    if ops or not pages:
        flush_page()
    return _build_pdf(pages)
