import { RefreshCw } from "lucide-react";
import { Badge, Button, ErrorState, LoadingPanel, PageHeader } from "../../../components/ui";
import { titleCase } from "../../../lib/utils";
import { useAuth } from "../../auth/useAuth";
import { CapabilityMatrix } from "../components/CapabilityMatrix";
import { RuntimePanels } from "../components/RuntimePanels";
import { ServiceHealthPanel } from "../components/ServiceHealthPanel";
import { SessionPanel } from "../components/SessionPanel";
import { TrustBoundaries } from "../components/TrustBoundaries";
import { useDetailedHealth, useSettingsInfo } from "../queries";

export default function SettingsPage() {
  const { me, logout } = useAuth();
  const settings = useSettingsInfo();
  const health = useDetailedHealth();

  if (settings.isError) {
    return (
      <>
        <PageHeader eyebrow="Configuration" title="Settings" />
        <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Runtime posture, session and login controls, model availability, and the server-enforced role capability matrix."
        meta={
          <>
            <Badge tone={settings.data?.environment === "production" ? "low" : "medium"}>
              {settings.data ? titleCase(settings.data.environment) : "\uFFFD"}
            </Badge>
            {settings.data?.demo_mode && <Badge tone="violet">Demo mode enabled</Badge>}
          </>
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void settings.refetch();
              void health.refetch();
            }}
            loading={settings.isFetching || health.isFetching}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {settings.isLoading || !settings.data ? (
        <LoadingPanel rows={6} label="Loading environment settings" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <SessionPanel me={me} settings={settings.data} onSignOut={() => void logout()} />
            <ServiceHealthPanel health={health} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RuntimePanels settings={settings.data} />
          </div>

          <CapabilityMatrix role={me?.role} />
          <TrustBoundaries limitations={settings.data.limitations} />
        </div>
      )}
    </>
  );
}
