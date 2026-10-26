import {
  Activity,
  BookLock,
  Boxes,
  Fingerprint,
  Home,
  KeyRound,
  Radar,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../types/api";

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "Command" | "Detect" | "Respond" | "Control" | "Assurance";
  roles?: Role[];
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Overview",
    description: "Command center and live posture",
    icon: Home,
    group: "Command",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
    end: true,
  },
  {
    to: "/me",
    label: "My security",
    description: "Your identity posture and devices",
    icon: Fingerprint,
    group: "Command",
  },
  {
    to: "/access",
    label: "Access decisions",
    description: "Zero-trust policy evaluations",
    icon: KeyRound,
    group: "Detect",
  },
  {
    to: "/behavior",
    label: "Behavioral risk",
    description: "Anomaly signals and contributor analysis",
    icon: Radar,
    group: "Detect",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/identities",
    label: "Identities",
    description: "People, sessions, and risk history",
    icon: Fingerprint,
    group: "Detect",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/incidents",
    label: "Incidents",
    description: "Investigation and response workflow",
    icon: ShieldAlert,
    group: "Respond",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/events",
    label: "Timeline",
    description: "Live security event stream",
    icon: Activity,
    group: "Respond",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/devices",
    label: "Devices",
    description: "Device trust and lifecycle",
    icon: Boxes,
    group: "Control",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/policies",
    label: "Policies",
    description: "Versioned access control rules",
    icon: ShieldCheck,
    group: "Control",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/model",
    label: "Anomaly model",
    description: "Evaluation metrics and limitations",
    icon: Waypoints,
    group: "Assurance",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/audit",
    label: "Audit ledger",
    description: "Append-only hash-chain evidence",
    icon: BookLock,
    group: "Assurance",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/demos",
    label: "Demo scenarios",
    description: "Six reproducible security stories",
    icon: Sparkles,
    group: "Assurance",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
  {
    to: "/settings",
    label: "Settings",
    description: "Profile, security, and environment",
    icon: Settings2,
    group: "Assurance",
    roles: ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"],
  },
];

export const NAV_GROUP_ORDER = ["Command", "Detect", "Respond", "Control", "Assurance"] as const;

export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

export function navForPath(pathname: string, role: Role): NavItem | undefined {
  const items = visibleNav(role);
  return items
    .filter((item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

export function pageTitle(pathname: string): string {
  if (pathname.startsWith("/identities/")) return "Identity dossier";
  if (pathname.startsWith("/access/")) return "Decision evidence";
  if (pathname.startsWith("/incidents/")) return "Incident workspace";
  if (pathname === "/me") return "My security";
  const item = NAV_ITEMS.find((nav) =>
    nav.end ? pathname === nav.to : pathname === nav.to || pathname.startsWith(`${nav.to}/`),
  );
  return item?.label ?? "AEGIS NEXUS";
}

export { ScrollText };
