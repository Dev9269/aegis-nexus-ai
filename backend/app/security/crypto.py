from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.config import get_settings

ALGORITHM = "AES-256-GCM"
KEY_VERSION = "v1"
CIPHER_PREFIX = f"enc:{KEY_VERSION}:"

_NONCE_BYTES = 12
_KEY_BYTES = 32

# Documented, non-secret development key (exactly 32 bytes). Production must
# supply AEGIS_ENCRYPTION_KEY, enforced by validate_runtime_settings.
_DEVELOPMENT_KEY = b"aegis-demo-encryption-key-32byte"


def _decode_key(raw: str) -> bytes:
    try:
        key = base64.urlsafe_b64decode(raw.encode("ascii"))
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError("AEGIS_ENCRYPTION_KEY must be base64-encoded.") from exc
    if len(key) != _KEY_BYTES:
        raise ValueError("AEGIS_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).")
    return key


def _active_key() -> bytes:
    settings = get_settings()
    if settings.encryption_key:
        return _decode_key(settings.encryption_key)
    if not settings.is_development:
        raise ValueError("AEGIS_ENCRYPTION_KEY is required outside development.")
    return _DEVELOPMENT_KEY


def key_source() -> str:
    return "AEGIS_ENCRYPTION_KEY" if get_settings().encryption_key else "development-default"


def is_encrypted(value: object) -> bool:
    return isinstance(value, str) and value.startswith(CIPHER_PREFIX)


def encrypt_value(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    if not isinstance(plaintext, str):
        plaintext = str(plaintext)
    nonce = os.urandom(_NONCE_BYTES)
    sealed = AESGCM(_active_key()).encrypt(nonce, plaintext.encode("utf-8"), None)
    payload = base64.urlsafe_b64encode(nonce + sealed).decode("ascii")
    return CIPHER_PREFIX + payload


def decrypt_value(stored: str | None) -> str | None:
    if stored is None:
        return None
    if not is_encrypted(stored):
        # Values written before encryption was enabled remain readable.
        return stored
    blob = base64.urlsafe_b64decode(stored[len(CIPHER_PREFIX) :].encode("ascii"))
    nonce, sealed = blob[:_NONCE_BYTES], blob[_NONCE_BYTES:]
    return AESGCM(_active_key()).decrypt(nonce, sealed, None).decode("utf-8")


class EncryptedString(TypeDecorator):
    """Transparently encrypt on write and decrypt on read with AES-256-GCM.

    Stored as ``enc:v1:<base64(nonce || ciphertext || tag)>`` so the database
    holds only ciphertext while the ORM and API continue to see plaintext.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: object, dialect: object) -> str | None:
        return encrypt_value(value)  # type: ignore[arg-type]

    def process_result_value(self, value: object, dialect: object) -> str | None:
        return decrypt_value(value)  # type: ignore[arg-type]
