from __future__ import annotations

from sqlalchemy import select

from app.models import AuditLog, Device, SecurityEvent
from app.seed import seed_demo_data
from tests.conftest import login


def test_admin_can_list_and_read_identity_detail(client, admin_identity, csrf_headers):
    csrf = login(client, admin_identity.email)
    listing = client.get("/api/identities")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    detail = client.get(f"/api/identities/{admin_identity.id}")
    assert detail.status_code == 200
    assert detail.json()["active_sessions"] == 1
    assert detail.json()["email"] == admin_identity.email


def test_employee_cannot_list_identities_or_read_another_identity(
    client, employee_identity, admin_identity
):
    login(client, employee_identity.email)
    assert client.get("/api/identities").status_code == 403
    assert client.get(f"/api/identities/{admin_identity.id}").status_code == 403
    own = client.get(f"/api/identities/{employee_identity.id}")
    assert own.status_code == 200


def test_admin_enrolls_and_revokes_device_with_audit_and_events(
    client, admin_identity, employee_identity, csrf_headers, db
):
    csrf = login(client, admin_identity.email)
    response = client.post(
        "/api/devices",
        json={
            "identity_id": employee_identity.id,
            "name": "Employee Laptop",
            "device_type": "Laptop",
            "operating_system": "Windows 11",
            "initial_state": "TRUSTED",
        },
        headers=csrf_headers(csrf),
    )
    assert response.status_code == 201, response.text
    device = response.json()
    assert device["state"] == "TRUSTED"
    assert device["signals"]["attestation"] == "not_performed"

    revoked = client.patch(
        f"/api/devices/{device['id']}/state",
        json={"state": "REVOKED", "reason": "Device reported lost by employee"},
        headers=csrf_headers(csrf),
    )
    assert revoked.status_code == 200
    assert revoked.json()["state"] == "REVOKED"
    assert revoked.json()["enrollment_status"] == "REVOKED"

    cannot_change = client.patch(
        f"/api/devices/{device['id']}/state",
        json={"state": "TRUSTED", "reason": "Attempted re-trust"},
        headers=csrf_headers(csrf),
    )
    assert cannot_change.status_code == 409

    assert db.scalar(select(Device).where(Device.id == device["id"])) is not None
    actions = {row.action for row in db.scalars(select(AuditLog))}
    assert "DEVICE_ENROLLED" in actions
    assert "DEVICE_REVOKED" in actions
    event_types = {row.event_type for row in db.scalars(select(SecurityEvent))}
    assert "DEVICE_ENROLLED" in event_types
    assert "DEVICE_REVOKED" in event_types


def test_employee_cannot_enroll_device(client, employee_identity, admin_identity, csrf_headers):
    csrf = login(client, employee_identity.email)
    response = client.post(
        "/api/devices",
        json={
            "identity_id": admin_identity.id,
            "name": "Rogue device",
            "device_type": "Laptop",
            "operating_system": "Linux",
            "initial_state": "TRUSTED",
        },
        headers=csrf_headers(csrf),
    )
    assert response.status_code == 403


def test_seed_is_idempotent_and_marks_data_simulated(db):
    first = seed_demo_data(db)
    second = seed_demo_data(db)
    assert first.created is True
    assert first.identities == 12
    assert second.created is False
    assert all(device.is_simulated for device in db.scalars(select(Device)))
