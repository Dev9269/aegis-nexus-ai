import { LogOut } from "lucide-react";
import { Avatar, Badge, Button, KeyValue, Panel, SectionHeading } from "../../../components/ui";
import { ROLE_LABELS } from "../../../lib/utils";
import type { Me, SettingsInfo } from "../../../types/api";

export function SessionPanel({
  me,
  settings,
  onSignOut,
}: {
  me: Me | null;
  settings: SettingsInfo;
  onSignOut: () => void;
}) {
  return (
    <Panel className="p-4 sm:p-5">
      <SectionHeading
        eyebrow="Session"
        title="Signed-in principal"
        description="The backend resolves this identity from an HttpOnly session cookie."
      />
      <div className="mt-4 flex items-center gap-3">
        <Avatar name={me?.display_name ?? "Unknown"} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{me?.display_name}</p>
          <p className="text-[11px] text-muted">{me?.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="accent">{me ? ROLE_LABELS[me.role] : "\uFFFD"}</Badge>
            <Badge tone={me?.status === "ACTIVE" ? "low" : "critical"}>{me?.status}</Badge>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <KeyValue label="Session TTL" value={`${settings.session_ttl_minutes} minutes`} />
        <KeyValue
          label="Login rate limit"
          value={`${settings.login_rate_limit} / ${settings.login_rate_window_seconds}s`}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut size={12} /> Sign out
        </Button>
      </div>
    </Panel>
  );
}
