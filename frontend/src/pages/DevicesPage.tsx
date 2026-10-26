import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Laptop,
  Monitor,
  Plus,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Tablet,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react";
import { api, messageFromError } from "../services/api";
import { useDevices, useIdentities } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import {
  Badge,
  Button,
  Callout,
  CopyInline,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  SelectInput,
  SimulatedTag,
  TextInput,
} from "../components/ui";
import type { Device, DeviceEnrollPayload, DeviceState } from "../types/api";
import {
  cn,
  formatDateTime,
  formatRelativeTime,
  titleCase,
} from "../lib/utils";

const PAGE_SIZE = 20;
const STATES: DeviceState[] = ["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"];
const STATE_TONES: Record<DeviceState, "low" | "medium" | "high" | "critical"> = {
  TRUSTED: "low",
  UNVERIFIED: "medium",
  RESTRICTED: "high",
  REVOKED: "critical",
};

function DeviceIcon({ type, className }: { type: string; className?: string }) {
  const Icon =
    type === "Mobile"
      ? Smartphone
      : type === "Tablet"
        ? Tablet
        : type === "Desktop"
          ? Monitor
          : type === "Virtual Machine"
            ? TerminalSquare
            : Laptop;
  return <Icon size={16} className={className} />;
}

export default function DevicesPage() {
  const { me } = useAuth();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<DeviceState | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Device | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const debounced = useDebouncedValue(search);
  const isAdmin = me?.role === "SECURITY_ADMIN";

  useEffect(() => {
    setPage(1);
  }, [debounced, state]);

  const params = { q: debounced || undefined, state: state || undefined, page, page_size: PAGE_SIZE };
  const devices = useDevices(params);
  const allDevices = useDevices({ page: 1, page_size: 200 });
  const rows = devices.data?.items ?? [];
  const all = allDevices.data?.items ?? [];

  const counts = {
    total: allDevices.data?.total ?? all.length,
    trusted: all.filter((device) => device.state === "TRUSTED").length,
    unverified: all.filter((device) => device.state === "UNVERIFIED").length,
    restricted: all.filter((device) => device.state === "RESTRICTED" || device.state === "REVOKED").length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Device posture"
        title="Devices"
        description="Device trust is a mandatory policy input. Revoked devices always deny; unverified devices may be challenged depending on resource policy."
        meta={
          <>
            <Badge tone="accent">{counts.total} enrolled</Badge>
            <Badge tone="low">{counts.trusted} trusted</Badge>
            {counts.unverified > 0 && <Badge tone="medium">{counts.unverified} unverified</Badge>}
            {counts.restricted > 0 && <Badge tone="critical">{counts.restricted} restricted/revoked</Badge>}
          </>
        }
        actions={
          isAdmin ? (
            <Button variant="solid" onClick={() => setEnrollOpen(true)}>
              <Plus size={14} /> Enroll device
            </Button>
          ) : (
            <span className="text-[10px] text-faint">Only security admins can change device state</span>
          )
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 p-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search device, owner, or operating system…"
            className="min-w-[230px] flex-1 sm:max-w-sm"
          />
          <SelectInput
            className="h-9 w-[150px] text-xs"
            value={state}
            onChange={(event) => setState(event.target.value as DeviceState | "")}
          >
            <option value="">All states</option>
            {STATES.map((value) => (
              <option key={value} value={value}>{titleCase(value)}</option>
            ))}
          </SelectInput>
          <span className="ml-auto text-[10px] text-faint">Posture changes are audited</span>
        </div>

        {devices.isError ? (
          <ErrorState message={devices.error.message} onRetry={() => void devices.refetch()} />
        ) : devices.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="skeleton h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ShieldOff size={18} />}
            title="No devices match"
            description="Adjust filters or enroll a device for an active identity."
            action={isAdmin ? <Button size="sm" variant="secondary" onClick={() => setEnrollOpen(true)}>Enroll device</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Owner</th>
                    <th>State</th>
                    <th className="hidden lg:table-cell">Platform</th>
                    <th className="hidden md:table-cell">Last observed</th>
                    <th className="hidden xl:table-cell">Enrolled</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((device) => (
                    <tr key={device.id} className="group cursor-pointer" onClick={() => setSelected(device)}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line/70 bg-raised/60 text-muted">
                            <DeviceIcon type={device.device_type} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-ink group-hover:text-accent">{device.name}</p>
                            <p className="text-[9px] text-faint">{device.device_type}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/identities/${device.identity_id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-[11px] text-muted hover:text-accent"
                        >
                          {device.identity_name ?? "Unknown"}
                        </Link>
                      </td>
                      <td><Badge tone={STATE_TONES[device.state]}>{titleCase(device.state)}</Badge></td>
                      <td className="hidden text-[11px] text-muted lg:table-cell">{device.operating_system}</td>
                      <td className="hidden text-[11px] text-muted md:table-cell">
                        {device.last_observed_at ? formatRelativeTime(device.last_observed_at) : "Never"}
                      </td>
                      <td className="hidden text-[11px] text-muted xl:table-cell">{formatDateTime(device.enrolled_at)}</td>
                      <td className="text-right"><SimulatedTag value={device.is_simulated} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={devices.data?.page ?? 1}
              pageSize={devices.data?.page_size ?? PAGE_SIZE}
              total={devices.data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Device"}
        eyebrow="Device posture"
      >
        {selected && (
          <DevicePanel
            device={selected}
            canWrite={isAdmin}
            onUpdated={(device) => setSelected(device)}
          />
        )}
      </Drawer>

      <EnrollModal open={enrollOpen} onClose={() => setEnrollOpen(false)} />
    </>
  );
}

function DevicePanel({
  device,
  canWrite,
  onUpdated,
}: {
  device: Device;
  canWrite: boolean;
  onUpdated: (device: Device) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [state, setState] = useState<DeviceState>(device.state);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setState(device.state);
    setReason("");
  }, [device]);

  const mutation = useMutation({
    mutationFn: () => api.updateDeviceState(device.id, state, reason.trim()),
    onSuccess: (updated) => {
      onUpdated(updated);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["identity", device.identity_id] });
      toast.success("Device posture updated", `State is now ${updated.state}.`);
    },
    onError: (error) => toast.error("Posture update failed", messageFromError(error)),
  });

  const signals = Object.entries(device.signals ?? {});

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line/65 bg-raised/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATE_TONES[device.state]}>{titleCase(device.state)}</Badge>
              <SimulatedTag value={device.is_simulated} />
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">{device.name}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {device.device_type} · {device.operating_system}
            </p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
            <DeviceIcon type={device.device_type} className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <KeyValue
            label="Owner"
            value={
              <Link to={`/identities/${device.identity_id}`} className="text-accent hover:underline">
                {device.identity_name ?? "Unknown"}
              </Link>
            }
          />
          <KeyValue label="Enrollment" value={titleCase(device.enrollment_status)} />
          <KeyValue label="Enrolled" value={formatDateTime(device.enrolled_at)} />
          <KeyValue label="Last observed" value={device.last_observed_at ? formatDateTime(device.last_observed_at) : "Never"} />
          {device.revoked_at && <KeyValue label="Revoked" value={formatDateTime(device.revoked_at)} />}
          <KeyValue label="Device ID" value={<CopyInline value={device.id} />} />
        </div>
      </div>

      <section>
        <h3 className="eyebrow mb-2">Telemetry signals</h3>
        {signals.length === 0 ? (
          <p className="rounded-lg border border-line/60 p-3 text-xs text-muted">No signals reported.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-line/60 bg-canvas/40 p-3">
            {signals.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-2 text-[10px]">
                <span className="font-mono text-faint">{key}</span>
                <span className="max-w-[120px] break-words text-right text-ink">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {canWrite ? (
        <section className="rounded-xl border border-line/65 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={15} className="text-accent" />
            <p className="text-xs font-semibold text-ink">Change posture</p>
          </div>
          <div className="space-y-3">
            <Field label="Target state">
              <SelectInput value={state} onChange={(event) => setState(event.target.value as DeviceState)}>
                {STATES.map((value) => (
                  <option key={value} value={value}>{titleCase(value)}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Reason" hint="Minimum 3 characters. The change is audit logged.">
              <TextInput
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this posture change required?"
              />
            </Field>
            {(state === "REVOKED" || state === "RESTRICTED") && (
              <Callout tone="warning" icon={<TriangleAlert size={15} />} title="Mandatory control impact">
                A {state.toLowerCase()} device can cause future policy denials for this identity.
              </Callout>
            )}
            {mutation.isError && <p className="text-[11px] text-critical">{messageFromError(mutation.error)}</p>}
            <div className="flex justify-end">
              <Button
                variant={state === "REVOKED" ? "danger" : "solid"}
                size="sm"
                loading={mutation.isPending}
                disabled={reason.trim().length < 3 || state === device.state}
                onClick={() => mutation.mutate()}
              >
                Apply posture change
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <Callout tone="info" title="Read-only posture">
          Only security admins can enroll devices or change device trust state.
        </Callout>
      )}
    </div>
  );
}

function EnrollModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const identities = useIdentities({ page: 1, page_size: 200, status: "ACTIVE" }, open);
  const [identityId, setIdentityId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceEnrollPayload["device_type"]>("Laptop");
  const [os, setOs] = useState("macOS 15");
  const [initialState, setInitialState] = useState<DeviceEnrollPayload["initial_state"]>("UNVERIFIED");

  useEffect(() => {
    if (open) {
      setIdentityId("");
      setName("");
      setType("Laptop");
      setOs("macOS 15");
      setInitialState("UNVERIFIED");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: api.enrollDevice,
    onSuccess: (device) => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.invalidateQueries({ queryKey: ["identity", device.identity_id] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Device enrolled", `${device.name} is ${device.state.toLowerCase()}.`);
      onClose();
    },
    onError: (error) => toast.error("Enrollment failed", messageFromError(error)),
  });

  const submit = () => {
    if (!identityId || name.trim().length < 2 || os.trim().length < 2) return;
    mutation.mutate({
      identity_id: identityId,
      name: name.trim(),
      device_type: type,
      operating_system: os.trim(),
      initial_state: initialState,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll device"
      description="Register a device against an active identity. Enrollment attempts are audit logged."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="solid"
            loading={mutation.isPending}
            disabled={!identityId || name.trim().length < 2 || os.trim().length < 2}
            onClick={submit}
          >
            Enroll device
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Identity">
          <SelectInput value={identityId} onChange={(event) => setIdentityId(event.target.value)}>
            <option value="">Select active identity…</option>
            {identities.data?.items.map((identity) => (
              <option key={identity.id} value={identity.id}>
                {identity.display_name} · {identity.email}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Device name">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Maya MacBook Pro"
            />
          </Field>
          <Field label="Device type">
            <SelectInput value={type} onChange={(event) => setType(event.target.value as DeviceEnrollPayload["device_type"])}>
              {["Laptop", "Desktop", "Mobile", "Tablet", "Virtual Machine"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Operating system">
          <TextInput value={os} onChange={(event) => setOs(event.target.value)} placeholder="macOS 15" />
        </Field>
        <Field label="Initial trust state" hint="Prefer UNVERIFIED unless the device was provisioned by IT.">
          <SelectInput
            value={initialState}
            onChange={(event) => setInitialState(event.target.value as DeviceEnrollPayload["initial_state"])}
          >
            <option value="UNVERIFIED">Unverified</option>
            <option value="TRUSTED">Trusted</option>
          </SelectInput>
        </Field>
        {mutation.isError && <p className="text-[11px] text-critical">{messageFromError(mutation.error)}</p>}
        <Callout tone="info" title="Demo vs live data">
          Devices enrolled here are marked real, not simulated. Demo devices retain the simulated label.
        </Callout>
      </div>
    </Modal>
  );
}
