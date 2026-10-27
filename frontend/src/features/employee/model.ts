import type { IdentityDetail } from "../../types/api";

export interface GuidanceItem {
  title: string;
  body: string;
  tone: "success" | "info" | "warning";
}

export const DEVICE_STATE_TONES: Record<string, "low" | "medium" | "high" | "critical"> = {
  TRUSTED: "low",
  UNVERIFIED: "medium",
  RESTRICTED: "high",
  REVOKED: "critical",
};

export function buildGuidance(detail: IdentityDetail): GuidanceItem[] {
  const guidance: GuidanceItem[] = [];
  const untrustedDevices = detail.devices.filter((device) => device.state !== "TRUSTED");

  if (detail.current_risk >= 70) {
    guidance.push({
      title: "Contact security before retrying sensitive access",
      body: "Your recent behavior looks unusual to the anomaly model. Security can verify context and help you continue safely.",
      tone: "warning",
    });
  }
  if (untrustedDevices.length > 0) {
    guidance.push({
      title: "Review device trust",
      body: `${untrustedDevices.length} device${untrustedDevices.length === 1 ? "" : "s"} are unverified or restricted. Use an IT-managed device for sensitive resources.`,
      tone: "warning",
    });
  }
  if (detail.active_sessions > 2) {
    guidance.push({
      title: "Review active sessions",
      body: `You have ${detail.active_sessions} active sessions. Sign out of sessions you no longer need.`,
      tone: "info",
    });
  }
  if (guidance.length === 0) {
    guidance.push({
      title: "Your current posture is healthy",
      body: "Devices are trusted, sessions are within policy, and no high-risk anomalies are awaiting review.",
      tone: "success",
    });
  }

  return guidance;
}

export function countDeniedRequests(detail: IdentityDetail): number {
  return detail.recent_access.filter((request) => request.decision === "DENY").length;
}
