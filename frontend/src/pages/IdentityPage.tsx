import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Filter, Users } from "lucide-react";
import { useIdentities } from "../hooks/queries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  RiskBadge,
  SearchInput,
  SelectInput,
  SimulatedTag,
} from "../components/ui";
import { ROLE_LABELS, formatNumber, formatRelativeTime, titleCase } from "../lib/utils";
import { ROLE_OPTIONS } from "../lib/constants";
import type { Role } from "../types/api";

const PAGE_SIZE = 20;

export default function IdentityPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED" | "">("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  useEffect(() => {
    setPage(1);
  }, [debounced, role, status]);

  const identities = useIdentities({
    q: debounced || undefined,
    role: role || undefined,
    status: status || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const rows = identities.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Identity fabric"
        title="Identities"
        description="Every workforce identity with current behavioral risk, account status, and activity context."
        meta={
          <>
            <Badge tone="accent">{identities.data ? `${formatNumber(identities.data.total)} identities` : "Directory"}</Badge>
            <span className="text-[10px] text-faint">Risk reflects the latest behavioral signal</span>
          </>
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 p-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, department…"
            className="min-w-[220px] flex-1 sm:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Filter size={13} className="hidden text-faint sm:block" />
            <SelectInput value={role} onChange={(event) => setRole(event.target.value as Role | "")} className="h-9 w-[155px] text-xs">
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              value={status}
              onChange={(event) => setStatus(event.target.value as "ACTIVE" | "DISABLED" | "")}
              className="h-9 w-[130px] text-xs"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </SelectInput>
          </div>
        </div>

        {identities.isError ? (
          <ErrorState message={identities.error.message} onRetry={() => void identities.refetch()} />
        ) : identities.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="skeleton h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users size={18} />}
            title="No identities match"
            description="Adjust search or filters. The demo seed creates twelve identities."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Role</th>
                    <th className="hidden md:table-cell">Department</th>
                    <th>Status</th>
                    <th>Current risk</th>
                    <th className="hidden lg:table-cell">Last activity</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((identity) => (
                    <tr key={identity.id} className="group">
                      <td>
                        <Link to={`/identities/${identity.id}`} className="flex items-center gap-2.5">
                          <Avatar name={identity.display_name} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="block truncate text-xs font-semibold text-ink group-hover:text-accent">
                                {identity.display_name}
                              </span>
                              <SimulatedTag value={identity.is_simulated} />
                            </span>
                            <span className="block truncate text-[10px] text-faint">{identity.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Badge tone={identity.role === "SECURITY_ADMIN" ? "violet" : "neutral"}>
                          {ROLE_LABELS[identity.role]}
                        </Badge>
                      </td>
                      <td className="hidden text-xs text-muted md:table-cell">
                        <span className="block">{identity.department}</span>
                        <span className="block text-[10px] text-faint">{identity.title}</span>
                      </td>
                      <td>
                        <Badge tone={identity.status === "ACTIVE" ? "low" : "critical"} dot>
                          {titleCase(identity.status)}
                        </Badge>
                      </td>
                      <td>
                        <RiskBadge score={identity.current_risk} />
                      </td>
                      <td className="hidden text-xs text-muted lg:table-cell">
                        {formatRelativeTime(identity.last_activity_at)}
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/identities/${identity.id}`}
                          className="inline-flex rounded p-1 text-faint transition group-hover:text-accent"
                          aria-label={`Open ${identity.display_name}`}
                        >
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={identities.data?.page ?? 1}
              pageSize={identities.data?.page_size ?? PAGE_SIZE}
              total={identities.data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </div>
    </>
  );
}
