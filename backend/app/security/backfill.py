from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.security import crypto

# Table/column identifiers are hardcoded constants, never user input.
_ENCRYPTED_COLUMNS: list[tuple[str, str]] = [
    ("leak_findings", "leaked_value_masked"),
    ("leak_findings", "source_name"),
    ("leak_findings", "remediation"),
    ("incident_notes", "note"),
    ("incidents", "resolution"),
]


def encrypt_existing_rows(db: Session) -> int:
    """Encrypt any legacy plaintext rows in the encrypted columns.

    Idempotent: rows already carrying the ciphertext prefix are skipped, so
    this is safe to run on every start. Writes use raw SQL so the ciphertext
    is not encrypted a second time by the ``EncryptedString`` type.
    """
    updated = 0
    for table, column in _ENCRYPTED_COLUMNS:
        rows = db.execute(
            text(
                f"SELECT id, {column} FROM {table} "
                f"WHERE {column} IS NOT NULL AND {column} NOT LIKE :prefix"
            ),
            {"prefix": crypto.CIPHER_PREFIX + "%"},
        ).all()
        for record_id, plaintext in rows:
            db.execute(
                text(f"UPDATE {table} SET {column} = :value WHERE id = :id"),
                {"value": crypto.encrypt_value(plaintext), "id": record_id},
            )
            updated += 1
    if updated:
        db.commit()
    return updated
