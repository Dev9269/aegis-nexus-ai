import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings2,
  Sun,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { useNotifications } from "../../hooks/queries";
import type { StreamState } from "../../hooks/useRealtime";
import { pageTitle } from "../../lib/navigation";
import {
  cn,
  formatRelativeTime,
  ROLE_LABELS,
  RISK_STYLES,
  riskTone,
} from "../../lib/utils";
import { Avatar, SeverityBadge } from "../ui";

export function Topbar({
  streamState,
  onOpenMenu,
  onOpenSearch,
}: {
  streamState: StreamState;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const { me, isStaff, logout, isLoggingOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifications = useNotifications(isStaff);

  useEffect(() => {
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, [location.pathname, location.search]);

  if (!me) return null;
  const items = notifications.data ?? [];
  const unread = Math.min(items.length, 9);
  const streamLabel =
    streamState === "connected"
      ? "Live"
      : streamState === "connecting"
        ? "Linking"
        : streamState === "reconnecting"
          ? "Retrying"
          : "Offline";
  const streamTone =
    streamState === "connected"
      ? "bg-low"
      : streamState === "connecting" || streamState === "reconnecting"
        ? "bg-medium"
        : "bg-faint";

  const go = (to: string) => {
    setNotificationsOpen(false);
    setProfileOpen(false);
    navigate(to);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line/55 bg-canvas/75 px-4 backdrop-blur-xl sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-lg border border-line/70 bg-surface/70 p-2 text-muted transition hover:text-ink lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={17} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-faint">
          <span>Nexus</span>
          <span className="text-line">/</span>
          <span className="truncate">{pageTitle(location.pathname)}</span>
        </div>
        <p className="truncate text-sm font-semibold text-ink">{pageTitle(location.pathname)}</p>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-9 w-[220px] items-center gap-2 rounded-lg border border-line/70 bg-surface/75 px-3 text-left text-xs text-faint transition hover:border-accent/30 hover:text-muted md:flex"
      >
        <Search size={14} />
        <span className="flex-1">Quick navigate</span>
        <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[9px] text-faint">
          Ctrl K
        </kbd>
      </button>

      <div className="hidden items-center gap-1.5 rounded-full border border-line/60 bg-surface/60 px-2.5 py-1 text-[10px] text-muted xl:flex">
        <span className={cn("h-1.5 w-1.5 rounded-full", streamTone, streamState === "connected" && "animate-pulse")} />
        {streamLabel}
        {streamState === "connected" ? <Wifi size={10} className="text-low" /> : <WifiOff size={10} className="text-faint" />}
      </div>

      {me.demo_mode && (
        <span className="hidden rounded-full border border-accent-2/30 bg-accent-2/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-2 sm:inline-flex">
          Demo
        </span>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted transition hover:bg-raised/70 hover:text-ink"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {isStaff && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setProfileOpen(false);
              }}
              className="relative rounded-lg p-2 text-muted transition hover:bg-raised/70 hover:text-ink"
              aria-label={`Notifications (${unread})`}
              aria-expanded={notificationsOpen}
            >
              <Bell size={16} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-canvas bg-critical px-0.5 text-[8px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Close notifications"
                  onClick={() => setNotificationsOpen(false)}
                />
                <div className="absolute right-0 top-11 z-40 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
                  <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-ink">Security notifications</p>
                      <p className="text-[10px] text-faint">High and critical events</p>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] text-accent hover:underline"
                      onClick={() => go("/events")}
                    >
                      View all
                    </button>
                  </div>
                  <div className="scrollbar-thin max-h-[340px] overflow-y-auto">
                    {notifications.isLoading ? (
                      <p className="px-4 py-6 text-center text-xs text-muted">Loading notifications…</p>
                    ) : items.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-muted">No elevated events. The stream is quiet.</p>
                    ) : (
                      items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => go(item.link)}
                          className="flex w-full gap-2.5 border-b border-line/50 px-4 py-3 text-left transition last:border-0 hover:bg-raised/55"
                        >
                          <SeverityBadge severity={item.severity} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-medium leading-4 text-ink">{item.title}</span>
                            <span className="mt-1 block text-[10px] text-faint">
                              {item.event_type} · {formatRelativeTime(item.timestamp)}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg border border-transparent p-1 pl-1 pr-1.5 transition hover:border-line hover:bg-raised/40"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            <Avatar name={me.display_name} size="sm" />
            <ChevronDown size={13} className="hidden text-faint sm:block" />
          </button>
          {profileOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default"
                aria-label="Close profile menu"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-12 z-40 w-[min(92vw,288px)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
                <div className="border-b border-line/60 px-4 py-3.5">
                  <p className="truncate text-sm font-semibold text-ink">{me.display_name}</p>
                  <p className="truncate text-[10px] text-muted">{me.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-line bg-raised px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
                      {ROLE_LABELS[me.role]}
                    </span>
                    <span className={cn("chip", RISK_STYLES[riskTone(me.current_risk)])}>
                      Risk {me.current_risk.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => go("/me")}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted transition hover:bg-raised hover:text-ink"
                  >
                    <UserRound size={14} /> My security
                  </button>
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => go("/settings")}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted transition hover:bg-raised hover:text-ink"
                    >
                      <Settings2 size={14} /> Settings
                    </button>
                  )}
                  <a
                    href="/api/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted transition hover:bg-raised hover:text-ink"
                  >
                    <BookOpen size={14} /> API documentation
                  </a>
                  <div className="my-1 h-px bg-line/60" />
                  <button
                    type="button"
                    onClick={() => void logout()}
                    disabled={isLoggingOut}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted transition hover:bg-critical/10 hover:text-critical disabled:opacity-50"
                  >
                    <LogOut size={14} /> {isLoggingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
