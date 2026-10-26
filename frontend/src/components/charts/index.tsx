import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, DECISION_COLORS, RISK_COLORS } from "../../lib/constants";
import { formatNumber, formatTime } from "../../lib/utils";
import type { NamedCount, RiskPoint, TimelinePoint } from "../../types/api";
import { EmptyState } from "../ui";

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix = "",
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs shadow-panel backdrop-blur">
      {label !== undefined && (
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
          {typeof label === "string" ? formatTime(label) : label}
        </p>
      )}
      {payload.map((item) => (
        <div key={item.dataKey ?? item.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
          <span className="font-mono text-[11px] text-ink">
            {formatNumber(Number(item.value ?? 0))}
            {valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ActivityTimelineChart({ data }: { data: TimelinePoint[] }) {
  if (!data.length) return <EmptyState title="No timeline data" description="Events will appear here." />;
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="accessFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.32} />
              <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="eventFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent2} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_COLORS.accent2} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.line} strokeOpacity={0.35} vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={(value: string) => formatTime(value).slice(0, 5)}
            stroke={CHART_COLORS.muted}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            stroke={CHART_COLORS.muted}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.accent, strokeOpacity: 0.2 }} />
          <Area
            type="monotone"
            dataKey="access_requests"
            name="Access requests"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            fill="url(#accessFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Area
            type="monotone"
            dataKey="security_events"
            name="Security events"
            stroke={CHART_COLORS.accent2}
            strokeWidth={1.6}
            fill="url(#eventFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="high_risk"
            name="High risk"
            stroke={CHART_COLORS.high}
            strokeWidth={1.4}
            strokeDasharray="4 4"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskHistoryChart({ data }: { data: RiskPoint[] }) {
  const points = [...data].reverse();
  if (!points.length) {
    return <EmptyState title="No behavioral history yet" description="Risk points appear after access evaluations." />;
  }
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.line} strokeOpacity={0.35} vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value: string) => formatTime(value).slice(0, 5)}
            stroke={CHART_COLORS.muted}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            stroke={CHART_COLORS.muted}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip valueSuffix=" / 100" />} />
          <Line
            type="monotone"
            dataKey="risk_score"
            name="Risk index"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            dot={{ r: 2, fill: CHART_COLORS.accent, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskDonut({ data }: { data: NamedCount[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="relative h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={54}
            outerRadius={76}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? CHART_COLORS.line} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-semibold text-ink">{formatNumber(total)}</span>
        <span className="text-[9px] uppercase tracking-[0.16em] text-faint">requests</span>
      </div>
    </div>
  );
}

export function DecisionBars({ data }: { data: NamedCount[] }) {
  if (!data.some((item) => item.value > 0)) {
    return <EmptyState title="No decisions yet" description="Evaluate access to populate this breakdown." />;
  }
  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.line} strokeOpacity={0.3} vertical={false} />
          <XAxis
            dataKey="name"
            stroke={CHART_COLORS.muted}
            tick={{ fontSize: 9, fill: CHART_COLORS.muted }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke={CHART_COLORS.muted}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.line, fillOpacity: 0.2 }} />
          <Bar dataKey="value" name="Decisions" radius={[5, 5, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={DECISION_COLORS[entry.name] ?? CHART_COLORS.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
