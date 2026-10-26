import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Decision, IncidentStatus, RiskCategory, Role, Severity } from "../types/api";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function riskTone(score: number): RiskCategory {
  if (score < 30) return "LOW";
  if (score < 55) return "MEDIUM";
  if (score < 80) return "HIGH";
  return "CRITICAL";
}

export const RISK_STYLES: Record<RiskCategory, string> = {
  LOW: "border-low/30 bg-low/10 text-low",
  MEDIUM: "border-medium/30 bg-medium/10 text-medium",
  HIGH: "border-high/30 bg-high/10 text-high",
  CRITICAL: "border-critical/35 bg-critical/10 text-critical",
};

export const DECISION_STYLES: Record<Decision, string> = {
  ALLOW: "border-low/30 bg-low/10 text-low",
  CHALLENGE: "border-medium/30 bg-medium/10 text-medium",
  RESTRICT: "border-high/30 bg-high/10 text-high",
  DENY: "border-critical/35 bg-critical/10 text-critical",
};

export const SEVERITY_STYLES: Record<Severity, string> = {
  LOW: "border-low/30 bg-low/10 text-low",
  MEDIUM: "border-medium/30 bg-medium/10 text-medium",
  HIGH: "border-high/30 bg-high/10 text-high",
  CRITICAL: "border-critical/35 bg-critical/10 text-critical",
};

export const DECISION_ICON_LABEL: Record<Decision, string> = {
  ALLOW: "Verified",
  CHALLENGE: "Step-up",
  RESTRICT: "Contained",
  DENY: "Blocked",
};

export const ROLE_LABELS: Record<Role, string> = {
  SECURITY_ADMIN: "Security admin",
  SECURITY_ANALYST: "Security analyst",
  EMPLOYEE: "Employee",
  AUDITOR: "Auditor",
};

export const ROLE_SHORT: Record<Role, string> = {
  SECURITY_ADMIN: "ADMIN",
  SECURITY_ANALYST: "ANALYST",
  EMPLOYEE: "EMPLOYEE",
  AUDITOR: "AUDITOR",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Open",
  INVESTIGATING: "Investigating",
  CONTAINED: "Contained",
  RESOLVED: "Resolved",
  FALSE_POSITIVE: "False positive",
};

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return "—";
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return `${formatNumber(value, maximumFractionDigits)}%`;
}

export function truncateId(value: string | null | undefined, length = 10): string {
  if (!value) return "—";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function humanizeAction(action: string): string {
  return action
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function rangeStartIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
