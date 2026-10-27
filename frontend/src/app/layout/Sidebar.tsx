import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogOut, Shield, X } from "lucide-react";
import { NAV_GROUP_ORDER, visibleNav } from "../../lib/navigation";
import { cn, ROLE_LABELS, initials } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { BrandMark } from "../../components/layout/BrandMark";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { me, logout, isLoggingOut } = useAuth();
  const mobileRef = useDialogFocus<HTMLElement>(mobileOpen, onCloseMobile);
  if (!me) return null;
  const items = visibleNav(me.role);

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-line/55 px-4", collapsed ? "justify-center" : "justify-between")}>
        <BrandMark collapsed={collapsed} />
        {!collapsed && (
          <button
            type="button"
            data-autofocus
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-faint transition hover:bg-raised hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2.5 py-4" aria-label="Primary">
        {NAV_GROUP_ORDER.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group} className="mb-4">
              {!collapsed && <p className="mb-1.5 px-2.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-faint/80">{group}</p>}
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onCloseMobile}
                      title={collapsed ? `${item.label} — ${item.description}` : undefined}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition",
                          collapsed && "justify-center px-0",
                          isActive
                            ? "bg-accent/10 text-ink"
                            : "text-muted hover:bg-raised/65 hover:text-ink",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent)/0.9)]" />
                          )}
                          <Icon
                            size={16}
                            className={cn("shrink-0 transition", isActive ? "text-accent" : "text-faint group-hover:text-muted")}
                          />
                          {!collapsed && (
                            <span className="min-w-0 flex-1 truncate">
                              <span className="block font-medium">{item.label}</span>
                              <span className="block truncate text-[10px] font-normal text-faint">{item.description}</span>
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line/55 p-3">
        {!collapsed ? (
          <>
            <div className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-line/60 bg-raised/40 p-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-[10px] font-semibold text-accent">
                {initials(me.display_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{me.display_name}</p>
                <p className="truncate text-[10px] text-faint">{ROLE_LABELS[me.role]}</p>
              </div>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-low" title="Authenticated session active" />
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-faint">
                <Shield size={10} />
                Zero trust
              </span>
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden rounded p-1 text-faint transition hover:bg-raised hover:text-ink lg:inline-flex"
                aria-label="Collapse sidebar"
              >
                <ChevronsLeft size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="rounded-md p-1.5 text-faint transition hover:bg-raised hover:text-ink"
              aria-label="Expand sidebar"
            >
              <ChevronsRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              className="rounded-md p-1.5 text-faint transition hover:bg-raised hover:text-critical"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-line/55 bg-surface/85 backdrop-blur-xl transition-[width] duration-300 lg:block",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside
            ref={mobileRef}
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            className="absolute inset-y-0 left-0 w-[280px] animate-fade-in border-r border-line bg-surface shadow-2xl"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
