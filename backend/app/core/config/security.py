from __future__ import annotations


class EncryptionFields:
    # Base64-encoded 32-byte (256-bit) AES key used for field-level encryption
    # at rest. Left empty in development so local runs and tests use a
    # documented, non-secret default key; required outside development.
    encryption_key: str = ""
