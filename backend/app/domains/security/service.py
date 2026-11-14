from __future__ import annotations

from types import SimpleNamespace

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.roles import STAFF_ROLES
from app.db.models import Identity, IncidentNote, LeakFinding, UserSession, utcnow
from app.domains.audit.service import verify_audit_chain
from app.domains.security.schemas import (
    AuditChainPosture,
    AuthenticationPosture,
    AuthorizationPosture,
    AuthorizationProbe,
    CookiePosture,
    CsrfPosture,
    EncryptionPosture,
    EncryptionSample,
    PasswordHashingPosture,
    RateLimitPosture,
    SessionTokenPosture,
)
from app.domains.threatintel.service import _ensure_seeded
from app.security import crypto
from app.security.passwords import SCRYPT_DKLEN, SCRYPT_N, SCRYPT_P, SCRYPT_R
from app.security.sessions import resolve_session

ENCRYPTED_FIELDS = [
    "leak_findings.leaked_value_masked",
    "leak_findings.source_name",
    "leak_findings.remediation",
    "incident_notes.note",
    "incidents.resolution",
]

_ENCRYPTED_COLUMNS = [
    ("leak_findings", "leaked_value_masked"),
    ("leak_findings", "source_name"),
    ("leak_findings", "remediation"),
    ("incident_notes", "note"),
    ("incidents", "resolution"),
]

STAFF_ONLY_ROUTES = [
    "/api/audit",
    "/api/identities",
    "/api/incidents",
    "/api/compliance/report",
    "/api/security/encryption",
    "/api/security/authentication",
]


def _count(db: Session, column) -> int:
    return int(db.scalar(select(func.count(column))) or 0)


def _probe_status(call) -> int:
    try:
        call()
        return 200
    except ApiError as exc:
        return exc.status_code


def _authorization_probe(db: Session, identity: Identity, session: UserSession) -> AuthorizationProbe:
    staff_dependency = require_roles(*STAFF_ROLES)
    employee_context = AuthContext(
        identity=SimpleNamespace(role="EMPLOYEE"),  # type: ignore[arg-type]
        session=session,
    )
    staff_context = AuthContext(identity=identity, session=session)

    no_session_status = 401 if resolve_session(db, None) is None else 200
    employee_status = _probe_status(lambda: staff_dependency(employee_context))
    staff_status = _probe_status(lambda: staff_dependency(staff_context))
    return AuthorizationProbe(
        no_session_status=no_session_status,
        employee_role_status=employee_status,
        staff_role_status=staff_status,
        enforced=no_session_status == 401 and employee_status == 403 and staff_status == 200,
    )


def _count_plaintext_leaks(db: Session) -> int:
    leaks = 0
    for table, column in _ENCRYPTED_COLUMNS:
        statement = text(
            f"SELECT COUNT(*) FROM {table} "
            f"WHERE {column} IS NOT NULL AND {column} NOT LIKE 'enc:v1:%'"
        )
        leaks += int(db.scalar(statement) or 0)
    return leaks


def get_encryption_posture(db: Session) -> EncryptionPosture:
    _ensure_seeded(db)
    encrypted_records = _count(db, LeakFinding.id) + _count(db, IncidentNote.id)
    return EncryptionPosture(
        algorithm=crypto.ALGORITHM,
        key_version=crypto.KEY_VERSION,
        key_source=crypto.key_source(),
        in_transit="TLS 1.2+ (HTTPS) at the edge; Secure + HttpOnly + SameSite cookies",
        at_rest="AES-256-GCM authenticated field-level encryption",
        secrets="scrypt password hashing; SHA-256 session-token hashing; SHA-256 audit chain",
        encrypted_fields=list(ENCRYPTED_FIELDS),
        encrypted_record_count=encrypted_records,
        plaintext_leaks=_count_plaintext_leaks(db),
        sample=_build_sample(db),
    )


def get_authentication_posture(db: Session, *, identity: Identity, session: UserSession) -> AuthenticationPosture:
    settings = get_settings()

    total_identities = _count(db, Identity.id)
    plaintext_passwords = int(
        db.scalar(
            select(func.count(Identity.id)).where(
                Identity.password_hash.notlike("scrypt$%")
            )
        )
        or 0
    )

    active_sessions = int(
        db.scalar(
            select(func.count(UserSession.id)).where(
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > utcnow(),
            )
        )
        or 0
    )
    revoked_sessions = int(
        db.scalar(
            select(func.count(UserSession.id)).where(UserSession.revoked_at.isnot(None))
        )
        or 0
    )
    raw_tokens = int(
        db.scalar(
            select(func.count(UserSession.id)).where(func.length(UserSession.token_hash) != 64)
        )
        or 0
    )

    verified, records, _record_id, message = verify_audit_chain(db)

    return AuthenticationPosture(
        password_hashing=PasswordHashingPosture(
            algorithm="scrypt",
            parameters={
                "N": SCRYPT_N,
                "r": SCRYPT_R,
                "p": SCRYPT_P,
                "dklen": SCRYPT_DKLEN,
                "identities": total_identities,
            },
            sample_hash_prefix=(identity.password_hash[:32] + "…") if identity.password_hash else None,
            plaintext_passwords_stored=plaintext_passwords,
        ),
        session_tokens=SessionTokenPosture(
            storage="SHA-256 digest of an opaque 256-bit token; the raw token is never stored",
            sample_token_hash=session.token_hash,
            active_sessions=active_sessions,
            revoked_sessions=revoked_sessions,
            raw_tokens_stored=raw_tokens,
        ),
        csrf=CsrfPosture(
            enabled=True,
            mode="Double-submit cookie (aegis_csrf) + X-CSRF-Token header, bound to the session",
        ),
        cookies=CookiePosture(
            session_cookie_httponly=True,
            session_cookie_secure=settings.cookie_secure,
            samesite="Lax",
            csrf_cookie_httponly=False,
        ),
        login_rate_limit=RateLimitPosture(
            limit=settings.login_rate_limit,
            window_seconds=settings.login_rate_window_seconds,
        ),
        authorization=AuthorizationPosture(
            mode="Server-side role dependencies; hidden UI is not a boundary",
            roles=list(STAFF_ROLES) + ["EMPLOYEE"],
            staff_only_routes=list(STAFF_ONLY_ROUTES),
            probe=_authorization_probe(db, identity, session),
        ),
        audit_chain=AuditChainPosture(
            verified=verified,
            records=records,
            message=message,
        ),
    )


def _build_sample(db: Session) -> EncryptionSample | None:
    # Read the raw stored bytes straight from the database (bypassing the ORM)
    # so the response can show ciphertext on disk next to the decrypted value.
    row = db.execute(text("SELECT id, leaked_value_masked FROM leak_findings LIMIT 1")).first()
    if row is not None:
        record_id, raw = row[0], row[1]
        return EncryptionSample(
            table="leak_findings",
            field="leaked_value_masked",
            record_id=record_id,
            stored_ciphertext=raw,
            decrypted_value=crypto.decrypt_value(raw) or "",
        )
    row = db.execute(text("SELECT id, note FROM incident_notes LIMIT 1")).first()
    if row is not None:
        record_id, raw = row[0], row[1]
        return EncryptionSample(
            table="incident_notes",
            field="note",
            record_id=record_id,
            stored_ciphertext=raw,
            decrypted_value=crypto.decrypt_value(raw) or "",
        )
    row = db.execute(
        text("SELECT id, resolution FROM incidents WHERE resolution IS NOT NULL LIMIT 1")
    ).first()
    if row is not None:
        record_id, raw = row[0], row[1]
        return EncryptionSample(
            table="incidents",
            field="resolution",
            record_id=record_id,
            stored_ciphertext=raw,
            decrypted_value=crypto.decrypt_value(raw) or "",
        )
    return None
