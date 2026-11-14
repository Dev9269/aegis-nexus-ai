from __future__ import annotations

from tests.conftest import login


def test_encryption_posture_requires_staff(client, employee_identity):
    login(client, employee_identity.email)
    response = client.get("/api/security/encryption")
    assert response.status_code == 403


def test_encryption_posture_reports_algorithm_and_fields(client, admin_identity):
    login(client, admin_identity.email)
    response = client.get("/api/security/encryption")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["algorithm"] == "AES-256-GCM"
    assert body["key_version"] == "v1"
    assert "leak_findings.leaked_value_masked" in body["encrypted_fields"]
    assert "incident_notes.note" in body["encrypted_fields"]


def test_encryption_posture_proves_ciphertext_at_rest(client, admin_identity):
    login(client, admin_identity.email)
    response = client.get("/api/security/encryption")
    assert response.status_code == 200, response.text
    sample = response.json()["sample"]
    assert sample is not None
    assert sample["stored_ciphertext"].startswith("enc:v1:")
    assert not sample["decrypted_value"].startswith("enc:v1:")
    assert sample["stored_ciphertext"] != sample["decrypted_value"]


def test_encryption_posture_reports_no_plaintext_leaks(client, admin_identity):
    login(client, admin_identity.email)
    response = client.get("/api/security/encryption")
    assert response.status_code == 200, response.text
    assert response.json()["plaintext_leaks"] == 0


def test_authentication_posture_requires_staff(client, employee_identity):
    login(client, employee_identity.email)
    response = client.get("/api/security/authentication")
    assert response.status_code == 403


def test_authentication_posture_reports_live_evidence(client, admin_identity):
    login(client, admin_identity.email)
    response = client.get("/api/security/authentication")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["password_hashing"]["algorithm"] == "scrypt"
    assert body["password_hashing"]["plaintext_passwords_stored"] == 0
    assert body["password_hashing"]["sample_hash_prefix"].startswith("scrypt$")

    session = body["session_tokens"]
    assert session["raw_tokens_stored"] == 0
    assert len(session["sample_token_hash"]) == 64
    assert session["active_sessions"] >= 1

    assert body["csrf"]["enabled"] is True
    assert body["cookies"]["session_cookie_httponly"] is True
    assert body["cookies"]["samesite"] == "Lax"
    assert body["audit_chain"]["verified"] is True
    assert "/api/security/authentication" in body["authorization"]["staff_only_routes"]


def test_authentication_posture_probes_authorization(client, admin_identity):
    login(client, admin_identity.email)
    response = client.get("/api/security/authentication")
    assert response.status_code == 200, response.text
    probe = response.json()["authorization"]["probe"]
    assert probe["no_session_status"] == 401
    assert probe["employee_role_status"] == 403
    assert probe["staff_role_status"] == 200
    assert probe["enforced"] is True
