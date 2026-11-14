from __future__ import annotations

import base64

import pytest
from sqlalchemy import text

from app.db.models import LeakFinding
from app.security import crypto


def test_encrypt_decrypt_round_trip():
    plaintext = "Leaked credential for jane@example.com"
    ciphertext = crypto.encrypt_value(plaintext)
    assert ciphertext != plaintext
    assert ciphertext.startswith("enc:v1:")
    assert crypto.decrypt_value(ciphertext) == plaintext


def test_ciphertext_is_nondeterministic():
    first = crypto.encrypt_value("same input")
    second = crypto.encrypt_value("same input")
    assert first != second
    assert crypto.decrypt_value(first) == crypto.decrypt_value(second) == "same input"


def test_tampered_ciphertext_is_rejected():
    ciphertext = crypto.encrypt_value("sensitive value")
    payload = ciphertext[len(crypto.CIPHER_PREFIX) :]
    flipped = base64.urlsafe_b64encode(
        bytes([base64.urlsafe_b64decode(payload)[0] ^ 0xFF]) + base64.urlsafe_b64decode(payload)[1:]
    ).decode("ascii")
    with pytest.raises(Exception):
        crypto.decrypt_value(crypto.CIPHER_PREFIX + flipped)


def test_legacy_plaintext_is_readable():
    assert crypto.decrypt_value("not-yet-encrypted") == "not-yet-encrypted"


def test_none_passes_through():
    assert crypto.encrypt_value(None) is None
    assert crypto.decrypt_value(None) is None


def test_leak_finding_stored_as_ciphertext(db):
    finding = LeakFinding(
        source_type="PASTE_SITE",
        source_name="Pastebin (public paste)",
        matched_field="email",
        leaked_value_masked="ab****yz",
        remediation="Rotate credentials immediately.",
    )
    db.add(finding)
    db.commit()

    raw = db.execute(
        text("SELECT source_name, leaked_value_masked, remediation FROM leak_findings")
    ).first()
    assert raw is not None
    assert raw[0].startswith("enc:v1:")
    assert raw[1].startswith("enc:v1:")
    assert raw[2].startswith("enc:v1:")
    assert "ab****yz" not in raw[1]

    db.expire_all()
    loaded = db.get(LeakFinding, finding.id)
    assert loaded is not None
    assert loaded.source_name == "Pastebin (public paste)"
    assert loaded.leaked_value_masked == "ab****yz"
    assert loaded.remediation == "Rotate credentials immediately."
