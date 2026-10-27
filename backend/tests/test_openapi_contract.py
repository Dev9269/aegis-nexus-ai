from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    "/api": {"get": "api_root_api_get"},
    "/api/health": {"get": "health_api_health_get"},
    "/api/health/ready": {"get": "readiness_api_health_ready_get"},
    "/api/health/detailed": {"get": "detailed_health_api_health_detailed_get"},
    "/api/auth/login": {"post": "login_api_auth_login_post"},
    "/api/auth/me": {"get": "me_api_auth_me_get"},
    "/api/auth/logout": {"post": "logout_api_auth_logout_post"},
    "/api/identities": {"get": "list_identities_api_identities_get"},
    "/api/identities/{identity_id}": {"get": "get_identity_api_identities__identity_id__get"},
    "/api/devices": {
        "get": "list_devices_api_devices_get",
        "post": "enroll_device_api_devices_post",
    },
    "/api/devices/{device_id}/state": {
        "patch": "update_device_state_api_devices__device_id__state_patch"
    },
    "/api/access-requests": {"get": "list_access_requests_api_access_requests_get"},
    "/api/access-requests/export.csv": {
        "get": "export_access_requests_api_access_requests_export_csv_get"
    },
    "/api/access-requests/evaluate": {
        "post": "evaluate_access_request_api_access_requests_evaluate_post"
    },
    "/api/access-requests/{request_id}": {
        "get": "get_access_request_api_access_requests__request_id__get"
    },
    "/api/resources": {"get": "list_resources_api_resources_get"},
    "/api/resources/{resource_id}": {"get": "get_resource_api_resources__resource_id__get"},
    "/api/resources/{resource_id}/policies": {
        "get": "get_policy_history_api_resources__resource_id__policies_get"
    },
    "/api/resources/{resource_id}/policy": {
        "put": "update_policy_api_resources__resource_id__policy_put"
    },
    "/api/policies/preview": {"post": "preview_policy_api_policies_preview_post"},
    "/api/events": {"get": "list_events_api_events_get"},
    "/api/events/{event_id}": {"get": "get_event_api_events__event_id__get"},
    "/api/notifications": {"get": "list_notifications_api_notifications_get"},
    "/api/incidents": {"get": "list_incidents_api_incidents_get"},
    "/api/incidents/{incident_id}": {
        "get": "get_incident_api_incidents__incident_id__get",
        "patch": "update_incident_api_incidents__incident_id__patch",
    },
    "/api/incidents/{incident_id}/notes": {
        "post": "add_incident_note_api_incidents__incident_id__notes_post"
    },
    "/api/overview": {"get": "get_overview_api_overview_get"},
    "/api/model/evaluation": {"get": "model_evaluation_api_model_evaluation_get"},
    "/api/model/features": {"get": "model_features_api_model_features_get"},
    "/api/model/retrain": {"post": "retrain_model_api_model_retrain_post"},
    "/api/audit": {"get": "list_audit_api_audit_get"},
    "/api/audit/verify": {"get": "verify_chain_api_audit_verify_get"},
    "/api/audit/export.csv": {"get": "export_audit_api_audit_export_csv_get"},
    "/api/settings/info": {"get": "settings_info_api_settings_info_get"},
    "/api/demo/scenarios": {"get": "get_demo_scenarios_api_demo_scenarios_get"},
    "/api/demo/scenarios/{scenario}": {
        "post": "run_demo_scenario_api_demo_scenarios__scenario__post"
    },
    "/api/demo/run": {"post": "run_all_demo_scenarios_api_demo_run_post"},
    "/api/demo/reset": {"post": "reset_demo_api_demo_reset_post"},
}


def test_openapi_paths_and_operation_ids_are_stable(client):
    schema = client.app.openapi()
    actual = {
        path: {method: operation["operationId"] for method, operation in methods.items()}
        for path, methods in schema["paths"].items()
    }
    assert actual == EXPECTED


def test_committed_openapi_matches_live_application(client):
    committed = json.loads((ROOT / "frontend" / "openapi.json").read_text(encoding="utf-8"))
    assert committed == json.loads(json.dumps(client.app.openapi()))
