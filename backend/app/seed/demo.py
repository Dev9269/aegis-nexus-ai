from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.config import get_settings
from app.db.models import (
    AccessPolicy,
    Device,
    Identity,
    Incident,
    IncidentNote,
    Resource,
    Role,
    Severity,
    new_id,
    utcnow,
)
from app.domains.events.service import record_event
from app.security.passwords import hash_password
from app.security.sessions import create_session

settings = get_settings()


@dataclass
class SeedResult:
    created: bool
    identities: int
    devices: int
    access_requests: int
    incidents: int


RESOURCE_DEFINITIONS = [
    {
        "key": "finance-reports",
        "name": "Finance Reports",
        "description": "Monthly close, forecast, and departmental finance reporting.",
        "sensitivity": "HIGH",
        "department": "Finance",
        "roles": ["EMPLOYEE", "SECURITY_ADMIN", "SECURITY_ANALYST"],
        "devices": ["TRUSTED", "UNVERIFIED"],
        "challenge": 55,
        "deny": 95,
        "session": 60,
    },
    {
        "key": "security-console",
        "name": "Security Operations Console",
        "description": "Privileged security telemetry and response controls.",
        "sensitivity": "CRITICAL",
        "department": "Security",
        "roles": ["SECURITY_ADMIN", "SECURITY_ANALYST"],
        "devices": ["TRUSTED"],
        "challenge": 35,
        "deny": 80,
        "session": 30,
    },
    {
        "key": "engineering-repo",
        "name": "Engineering Repository",
        "description": "Source code and build pipelines for internal products.",
        "sensitivity": "MEDIUM",
        "department": "Engineering",
        "roles": ["EMPLOYEE", "SECURITY_ADMIN", "SECURITY_ANALYST"],
        "devices": ["TRUSTED", "UNVERIFIED"],
        "challenge": 60,
        "deny": 92,
        "session": 120,
    },
    {
        "key": "hr-records",
        "name": "HR Records",
        "description": "Employee records, payroll metadata, and sensitive people data.",
        "sensitivity": "HIGH",
        "department": "People Operations",
        "roles": ["EMPLOYEE", "SECURITY_ADMIN"],
        "devices": ["TRUSTED"],
        "challenge": 45,
        "deny": 88,
        "session": 45,
    },
    {
        "key": "audit-archive",
        "name": "Audit Archive",
        "description": "Immutable security and compliance audit evidence.",
        "sensitivity": "HIGH",
        "department": "Security",
        "roles": ["SECURITY_ADMIN", "AUDITOR"],
        "devices": ["TRUSTED"],
        "challenge": 35,
        "deny": 85,
        "session": 30,
    },
    {
        "key": "executive-dashboard",
        "name": "Executive Risk Dashboard",
        "description": "Company-wide risk posture and confidential executive metrics.",
        "sensitivity": "CRITICAL",
        "department": "Executive",
        "roles": ["SECURITY_ADMIN"],
        "devices": ["TRUSTED"],
        "challenge": 30,
        "deny": 75,
        "session": 30,
    },
]

IDENTITY_DEFINITIONS = [
    ("Avery Cole", "admin@aegisnexus.ai", Role.SECURITY_ADMIN, "Security", "Security Administrator", "ACTIVE"),
    ("Jordan Reyes", "analyst@aegisnexus.ai", Role.SECURITY_ANALYST, "Security", "Threat Analyst", "ACTIVE"),
    ("Priya Nair", "auditor@aegisnexus.ai", Role.AUDITOR, "Compliance", "Read-only Auditor", "ACTIVE"),
    ("Maya Chen", "maya.chen@aegisnexus.ai", Role.EMPLOYEE, "Finance", "Finance Analyst", "ACTIVE"),
    ("Noah Williams", "noah.williams@aegisnexus.ai", Role.EMPLOYEE, "Finance", "Payroll Specialist", "DISABLED"),
    ("Leo Martins", "leo.martins@aegisnexus.ai", Role.EMPLOYEE, "Engineering", "Software Engineer", "ACTIVE"),
    ("Sofia Alvarez", "sofia.alvarez@aegisnexus.ai", Role.EMPLOYEE, "Sales", "Account Executive", "ACTIVE"),
    ("Hana Sato", "hana.sato@aegisnexus.ai", Role.EMPLOYEE, "People Operations", "People Partner", "ACTIVE"),
    ("Ethan Brooks", "ethan.brooks@aegisnexus.ai", Role.EMPLOYEE, "IT", "Systems Engineer", "ACTIVE"),
    ("Amara Okafor", "amara.okafor@aegisnexus.ai", Role.EMPLOYEE, "Finance", "Controller", "ACTIVE"),
    ("Lucas Meyer", "lucas.meyer@aegisnexus.ai", Role.EMPLOYEE, "Engineering", "Platform Engineer", "ACTIVE"),
    ("Grace Kim", "grace.kim@aegisnexus.ai", Role.EMPLOYEE, "Sales", "Sales Operations", "ACTIVE"),
]

DEVICE_DEFINITIONS = [
    ("admin@aegisnexus.ai", "Avery-MacBook-Pro", "Laptop", "macOS 15.2", "TRUSTED"),
    ("analyst@aegisnexus.ai", "Jordan-ThinkPad-X1", "Laptop", "Windows 11 Pro", "TRUSTED"),
    ("auditor@aegisnexus.ai", "Priya-Surface-Laptop", "Laptop", "Windows 11 Enterprise", "TRUSTED"),
    ("maya.chen@aegisnexus.ai", "Maya-MacBook-Air", "Laptop", "macOS 15.1", "TRUSTED"),
    ("maya.chen@aegisnexus.ai", "Maya-iPhone-15", "Mobile", "iOS 18.2", "TRUSTED"),
    ("maya.chen@aegisnexus.ai", "Unrecognized-Windows-VM", "Virtual Machine", "Windows 11", "UNVERIFIED"),
    ("noah.williams@aegisnexus.ai", "Noah-Dell-Latitude", "Laptop", "Windows 11 Pro", "RESTRICTED"),
    ("leo.martins@aegisnexus.ai", "Leo-Linux-Workstation", "Desktop", "Ubuntu 24.04", "TRUSTED"),
    ("sofia.alvarez@aegisnexus.ai", "Sofia-MacBook-Pro", "Laptop", "macOS 14.7", "TRUSTED"),
    ("hana.sato@aegisnexus.ai", "Hana-Surface-Pro", "Tablet", "Windows 11 Pro", "TRUSTED"),
    ("ethan.brooks@aegisnexus.ai", "Ethan-ThinkPad", "Laptop", "Fedora 41", "TRUSTED"),
    ("amara.okafor@aegisnexus.ai", "Amara-MacBook-Pro", "Laptop", "macOS 15.0", "TRUSTED"),
    ("lucas.meyer@aegisnexus.ai", "Lucas-Dev-Workstation", "Desktop", "Ubuntu 24.04", "TRUSTED"),
    ("grace.kim@aegisnexus.ai", "Grace-iPad-Pro", "Tablet", "iPadOS 18.1", "TRUSTED"),
]


def demo_data_exists(db: Session) -> bool:
    return bool(db.scalar(select(func.count(Identity.id))))


def seed_demo_data(db: Session) -> SeedResult:
    if demo_data_exists(db):
        return SeedResult(False, 0, 0, 0, 0)

    now = utcnow()
    password_hash = hash_password(settings.demo_password)
    identities: dict[str, Identity] = {}
    for name, email, role, department, title, status in IDENTITY_DEFINITIONS:
        identity = Identity(
            display_name=name,
            email=email,
            password_hash=password_hash,
            role=role.value,
            status=status,
            department=department,
            title=title,
            created_at=now - timedelta(days=120),
            last_activity_at=now - timedelta(minutes=8) if status == "ACTIVE" else now - timedelta(days=12),
            current_risk=12.0 if role == Role.EMPLOYEE else 6.0,
            is_simulated=True,
        )
        db.add(identity)
        identities[email] = identity
    db.flush()

    resources: dict[str, Resource] = {}
    for definition in RESOURCE_DEFINITIONS:
        resource = Resource(
            key=definition["key"],
            name=definition["name"],
            description=definition["description"],
            sensitivity=definition["sensitivity"],
            owner_department=definition["department"],
            is_active=True,
            is_simulated=True,
        )
        db.add(resource)
        db.flush()
        resources[resource.key] = resource
        db.add(
            AccessPolicy(
                resource_id=resource.id,
                version=1,
                allowed_roles=definition["roles"],
                allowed_device_states=definition["devices"],
                challenge_threshold=definition["challenge"],
                deny_threshold=definition["deny"],
                require_additional_verification=True,
                session_max_minutes=definition["session"],
                is_active=True,
                created_at=now - timedelta(days=100),
                change_reason="Initial seeded resource policy",
                is_simulated=True,
            )
        )

    devices: list[Device] = []
    for email, name, device_type, operating_system, state in DEVICE_DEFINITIONS:
        identity = identities[email]
        device = Device(
            identity_id=identity.id,
            name=name,
            device_type=device_type,
            operating_system=operating_system,
            state=state,
            enrollment_status="REVOKED" if state == "REVOKED" else "ENROLLED",
            last_observed_at=now - timedelta(minutes=5),
            enrolled_at=now - timedelta(days=45),
            signals={
                "simulated_attributes": True,
                "attestation": "not_performed",
                "managed": state in {"TRUSTED", "RESTRICTED"},
            },
            is_simulated=True,
        )
        db.add(device)
        devices.append(device)
    db.flush()

    for identity in identities.values():
        if identity.status != "ACTIVE":
            continue
        create_session(
            db,
            identity,
            settings.session_ttl_minutes,
            ip_address="10.20.4.0",
            user_agent="AEGIS demo session (simulated)",
            is_simulated=True,
        )

    analyst = identities["analyst@aegisnexus.ai"]
    maya = identities["maya.chen@aegisnexus.ai"]
    incident = Incident(
        title="Suspicious finance report access pattern",
        classification="Unusual behavior requiring investigation",
        severity=Severity.HIGH.value,
        status="OPEN",
        identity_id=maya.id,
        summary=(
            "A simulated behavioral anomaly suggests off-hours finance report access. "
            "This is an investigation lead, not proof of compromise."
        ),
        assigned_to=analyst.id,
        related_device_ids=[devices[5].id],
        created_at=now - timedelta(hours=2),
        updated_at=now - timedelta(hours=1, minutes=20),
        is_simulated=True,
    )
    db.add(incident)
    db.flush()
    db.add(
        IncidentNote(
            incident_id=incident.id,
            author_id=analyst.id,
            author_label=analyst.display_name,
            note="Correlated a new unverified device with an after-hours access attempt. Awaiting analyst review.",
            created_at=now - timedelta(hours=1, minutes=45),
        )
    )

    correlation_id = new_id()
    record_event(
        db,
        event_type="DEMO_DATA_SEEDED",
        category="System",
        summary="Synthetic demonstration organization initialized",
        correlation_id=correlation_id,
        severity=Severity.LOW.value,
        actor_id=identities["admin@aegisnexus.ai"].id,
        details={"identities": len(identities), "devices": len(devices), "incidents": 1},
        is_simulated=True,
    )
    append_audit(
        db,
        actor=identities["admin@aegisnexus.ai"],
        action="DEMO_DATA_SEEDED",
        target_type="environment",
        target_id=None,
        correlation_id=correlation_id,
        metadata={
            "identities": len(identities),
            "devices": len(devices),
            "incidents": 1,
            "simulated": True,
        },
    )
    db.commit()
    return SeedResult(True, len(identities), len(devices), 0, 1)
