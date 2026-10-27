import { Link } from "react-router-dom";
import { Cpu, FlaskConical, Globe2 } from "lucide-react";
import { Badge, Panel } from "../../../components/ui";
import type { SettingsInfo } from "../../../types/api";

export function RuntimePanels({ settings }: { settings: SettingsInfo }) {
  return (
    <>
      <Panel className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Globe2 size={15} className="text-accent" />
          <p className="text-xs font-semibold text-ink">Origin controls</p>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-muted">
          Cross-origin requests are restricted to the allowed origins below.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {settings.allowed_origins.map((origin) => (
            <span
              key={origin}
              className="rounded border border-line/70 bg-raised/50 px-2 py-1 font-mono text-[9px] text-muted"
            >
              {origin}
            </span>
          ))}
        </div>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Cpu size={15} className="text-accent" />
          <p className="text-xs font-semibold text-ink">Model artifact</p>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-muted">
          The active Isolation Forest artifact is required for evaluations.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={settings.model_artifact_available ? "low" : "critical"}>
            {settings.model_artifact_available ? "Available" : "Unavailable"}
          </Badge>
          <span className="font-mono text-[9px] text-faint">{settings.model_version ?? "No version"}</span>
        </div>
        <Link to="/model" className="btn-ghost btn-sm mt-3">
          Open model evaluation
        </Link>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <FlaskConical size={15} className="text-accent" />
          <p className="text-xs font-semibold text-ink">Demo controls</p>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-muted">
          Demo execution is gated server-side by mode and role. Reset preserves audit history.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={settings.demo_mode ? "violet" : "neutral"}>
            {settings.demo_mode ? "Demo mode on" : "Demo mode off"}
          </Badge>
        </div>
        <Link to="/demo" className="btn-ghost btn-sm mt-3">
          Open demo lab
        </Link>
      </Panel>
    </>
  );
}
