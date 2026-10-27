import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import {
  Badge,
  Callout,
  ErrorState,
  LoadingPanel,
  PageHeader,
  SimulatedTag,
} from "../../../components/ui";
import { ROLE_LABELS } from "../../../lib/utils";
import { useAuth } from "../../auth/useAuth";
import { AccessAndDevices } from "../components/AccessAndDevices";
import { GuidancePanel } from "../components/GuidancePanel";
import { PostureSummary } from "../components/PostureSummary";
import { RiskExplanation } from "../components/RiskExplanation";
import { buildGuidance, countDeniedRequests } from "../model";
import { useEmployeeIdentity } from "../queries";

export default function EmployeeHomePage() {
  const { me } = useAuth();
  const identity = useEmployeeIdentity(me?.id);

  if (identity.isError) {
    return (
      <>
        <PageHeader eyebrow="Personal console" title="My security posture" />
        <ErrorState message={identity.error.message} onRetry={() => void identity.refetch()} />
      </>
    );
  }

  if (identity.isLoading || !identity.data) {
    return (
      <>
        <PageHeader eyebrow="Personal console" title="My security posture" />
        <LoadingPanel rows={6} label="Loading your security context" />
      </>
    );
  }

  const detail = identity.data;
  const guidance = buildGuidance(detail);
  const deniedRecent = countDeniedRequests(detail);

  return (
    <>
      <PageHeader
        eyebrow="Personal console"
        title={`Welcome, ${detail.display_name.split(" ")[0]}`}
        description="Your access posture, recent decisions, enrolled devices, and the behavioral evidence behind your current risk index."
        meta={
          <>
            <Badge tone="accent">{ROLE_LABELS[detail.role]}</Badge>
            <Badge tone={detail.status === "ACTIVE" ? "low" : "critical"}>{detail.status}</Badge>
            <SimulatedTag value={detail.is_simulated} />
          </>
        }
        actions={
          <Link to="/access" className="btn-secondary">
            <KeyRound size={14} /> My access history
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <PostureSummary detail={detail} deniedRecent={deniedRecent} />
        <GuidancePanel guidance={guidance} />
      </div>

      <AccessAndDevices detail={detail} />
      <RiskExplanation detail={detail} />

      <div className="mt-4">
        <Callout tone="info" title="Need access to a resource?">
          Contact the security team or your manager. Access is granted through policy, not by changing the anomaly
          score. Sensitive resources may require step-up verification and a trusted device.
        </Callout>
      </div>
    </>
  );
}
