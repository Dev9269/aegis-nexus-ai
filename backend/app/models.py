from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Role(StrEnum):
    SECURITY_ADMIN = "SECURITY_ADMIN"
    SECURITY_ANALYST = "SECURITY_ANALYST"
    EMPLOYEE = "EMPLOYEE"
    AUDITOR = "AUDITOR"


class IdentityStatus(StrEnum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class DeviceState(StrEnum):
    TRUSTED = "TRUSTED"
    UNVERIFIED = "UNVERIFIED"
    RESTRICTED = "RESTRICTED"
    REVOKED = "REVOKED"


class EnrollmentStatus(StrEnum):
    ENROLLED = "ENROLLED"
    PENDING = "PENDING"
    REVOKED = "REVOKED"


class Sensitivity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskCategory(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Decision(StrEnum):
    ALLOW = "ALLOW"
    CHALLENGE = "CHALLENGE"
    DENY = "DENY"
    RESTRICT = "RESTRICT"


class IncidentStatus(StrEnum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    CONTAINED = "CONTAINED"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class Severity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Identity(Base):
    __tablename__ = "identities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), default=IdentityStatus.ACTIVE.value, index=True)
    department: Mapped[str] = mapped_column(String(80), nullable=False, default="General")
    title: Mapped[str] = mapped_column(String(120), nullable=False, default="Team Member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_risk: Mapped[float] = mapped_column(Float, default=0.0)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    sessions: Mapped[list[UserSession]] = relationship(back_populates="identity")
    devices: Mapped[list[Device]] = relationship(back_populates="identity")
    access_requests: Mapped[list[AccessRequest]] = relationship(back_populates="identity")
    behavioral_events: Mapped[list[BehavioralEvent]] = relationship(back_populates="identity")
    incidents: Mapped[list[Incident]] = relationship(back_populates="identity")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    identity: Mapped[Identity] = relationship(back_populates="sessions")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    device_type: Mapped[str] = mapped_column(String(40), nullable=False)
    operating_system: Mapped[str] = mapped_column(String(80), nullable=False)
    state: Mapped[str] = mapped_column(String(20), default=DeviceState.UNVERIFIED.value, index=True)
    enrollment_status: Mapped[str] = mapped_column(
        String(20), default=EnrollmentStatus.PENDING.value, index=True
    )
    last_observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    signals: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    identity: Mapped[Identity] = relationship(back_populates="devices")


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sensitivity: Mapped[str] = mapped_column(String(16), default=Sensitivity.MEDIUM.value)
    owner_department: Mapped[str] = mapped_column(String(80), default="Security")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    policies: Mapped[list[AccessPolicy]] = relationship(back_populates="resource")
    access_requests: Mapped[list[AccessRequest]] = relationship(back_populates="resource")


class AccessPolicy(Base):
    __tablename__ = "access_policies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    resource_id: Mapped[str] = mapped_column(ForeignKey("resources.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    allowed_roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    allowed_device_states: Mapped[list[str]] = mapped_column(JSON, default=list)
    challenge_threshold: Mapped[int] = mapped_column(Integer, default=55)
    deny_threshold: Mapped[int] = mapped_column(Integer, default=90)
    require_additional_verification: Mapped[bool] = mapped_column(Boolean, default=True)
    session_max_minutes: Mapped[int] = mapped_column(Integer, default=60)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    change_reason: Mapped[str] = mapped_column(Text, nullable=False, default="Initial policy")
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    resource: Mapped[Resource] = relationship(back_populates="policies")


class BehavioralEvent(Base):
    __tablename__ = "behavioral_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    features: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    risk_category: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    feature_summary: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    identity: Mapped[Identity] = relationship(back_populates="behavioral_events")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id"), nullable=False, index=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("resources.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    behavioral_event_id: Mapped[str | None] = mapped_column(
        ForeignKey("behavioral_events.id"), nullable=True
    )
    requested_action: Mapped[str] = mapped_column(String(40), default="READ")
    decision: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    risk_category: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    policy_version: Mapped[str] = mapped_column(String(80), nullable=False)
    reasons: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    correlation_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    identity: Mapped[Identity] = relationship(back_populates="access_requests")
    resource: Mapped[Resource] = relationship(back_populates="access_requests")
    device: Mapped[Device | None] = relationship()
    behavioral_event: Mapped[BehavioralEvent | None] = relationship()


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    classification: Mapped[str] = mapped_column(
        String(80), default="Unusual behavior requiring investigation"
    )
    severity: Mapped[str] = mapped_column(String(16), default=Severity.MEDIUM.value, index=True)
    status: Mapped[str] = mapped_column(String(24), default=IncidentStatus.OPEN.value, index=True)
    identity_id: Mapped[str | None] = mapped_column(
        ForeignKey("identities.id"), nullable=True, index=True
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    assigned_to: Mapped[str | None] = mapped_column(String(36), nullable=True)
    related_access_request_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    related_device_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    identity: Mapped[Identity | None] = relationship(back_populates="incidents")
    notes: Mapped[list[IncidentNote]] = relationship(back_populates="incident")


class IncidentNote(Base):
    __tablename__ = "incident_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), nullable=False, index=True)
    author_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    author_label: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    incident: Mapped[Incident] = relationship(back_populates="notes")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), default=Severity.LOW.value, index=True)
    summary: Mapped[str] = mapped_column(String(400), nullable=False)
    identity_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    device_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    access_request_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    incident_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    policy_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    sequence: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_label: Mapped[str] = mapped_column(String(160), nullable=False)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(40), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    result: Mapped[str] = mapped_column(String(24), nullable=False, default="SUCCESS")
    policy_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    record_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)


@event.listens_for(AuditLog, "before_update")
def _prevent_audit_update(mapper: Any, connection: Any, target: AuditLog) -> None:
    raise ValueError("Audit records are append-only and cannot be updated")


@event.listens_for(AuditLog, "before_delete")
def _prevent_audit_delete(mapper: Any, connection: Any, target: AuditLog) -> None:
    raise ValueError("Audit records are append-only and cannot be deleted")
