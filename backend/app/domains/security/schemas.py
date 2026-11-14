from __future__ import annotations

from pydantic import BaseModel


class EncryptionSample(BaseModel):
    table: str
    field: str
    record_id: str
    stored_ciphertext: str
    decrypted_value: str


class EncryptionPosture(BaseModel):
    algorithm: str
    key_version: str
    key_source: str
    in_transit: str
    at_rest: str
    secrets: str
    encrypted_fields: list[str]
    encrypted_record_count: int
    plaintext_leaks: int
    sample: EncryptionSample | None = None


class PasswordHashingPosture(BaseModel):
    algorithm: str
    parameters: dict[str, int]
    sample_hash_prefix: str | None
    plaintext_passwords_stored: int


class SessionTokenPosture(BaseModel):
    storage: str
    sample_token_hash: str | None
    active_sessions: int
    revoked_sessions: int
    raw_tokens_stored: int


class CsrfPosture(BaseModel):
    enabled: bool
    mode: str


class CookiePosture(BaseModel):
    session_cookie_httponly: bool
    session_cookie_secure: bool
    samesite: str
    csrf_cookie_httponly: bool


class RateLimitPosture(BaseModel):
    limit: int
    window_seconds: int


class AuthorizationProbe(BaseModel):
    no_session_status: int
    employee_role_status: int
    staff_role_status: int
    enforced: bool


class AuthorizationPosture(BaseModel):
    mode: str
    roles: list[str]
    staff_only_routes: list[str]
    probe: AuthorizationProbe


class AuditChainPosture(BaseModel):
    verified: bool
    records: int
    message: str


class AuthenticationPosture(BaseModel):
    password_hashing: PasswordHashingPosture
    session_tokens: SessionTokenPosture
    csrf: CsrfPosture
    cookies: CookiePosture
    login_rate_limit: RateLimitPosture
    authorization: AuthorizationPosture
    audit_chain: AuditChainPosture
