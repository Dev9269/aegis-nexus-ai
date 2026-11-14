"""widen leak_findings text columns for encryption

Revision ID: b7f1a2c4d9e0
Revises: c425a9ee779a
Create Date: 2026-11-14 12:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'b7f1a2c4d9e0'
down_revision: str | None = 'c425a9ee779a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Ciphertext is longer than plaintext, so widen the two VARCHAR columns to
    # TEXT to hold AES-256-GCM output (incidents.resolution, incident_notes.note
    # and leak_findings.remediation are already TEXT and need no change).
    with op.batch_alter_table('leak_findings') as batch_op:
        batch_op.alter_column(
            'source_name',
            existing_type=sa.String(length=160),
            type_=sa.Text(),
            existing_nullable=False,
        )
        batch_op.alter_column(
            'leaked_value_masked',
            existing_type=sa.String(length=120),
            type_=sa.Text(),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table('leak_findings') as batch_op:
        batch_op.alter_column(
            'source_name',
            existing_type=sa.Text(),
            type_=sa.String(length=160),
            existing_nullable=False,
        )
        batch_op.alter_column(
            'leaked_value_masked',
            existing_type=sa.Text(),
            type_=sa.String(length=120),
            existing_nullable=False,
        )
