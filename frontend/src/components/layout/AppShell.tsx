import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useRealtime } from "../../hooks/useRealtime";
import { useToast } from "../../hooks/useToast";
import { cn } from "../../lib/utils";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSE_KEY = "aegis.sidebarCollapsed";

export function AppShell() {
  const { isStaff } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const realtime = useRealtime(isStaff);
  const lastToastEvent = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const event = realtime.lastEvent;
    if (!event || lastToastEvent.current === event.id) return;
    lastToastEvent.current = event.id;
    if (event.severity === "HIGH" || event.severity === "CRITICAL") {
      toast.info(event.summary, `${event.event_type} · ${event.severity} severity`);
    }
  }, [realtime.lastEvent, toast]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // Local storage is optional.
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]",
        )}
      >
        <Topbar
          streamState={realtime.state}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1640px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-[1640px] flex-wrap items-center justify-between gap-2 px-4 pb-5 text-[10px] text-faint sm:px-6 lg:px-8">
          <span>AEGIS NEXUS AI · Adaptive zero-trust access</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-accent" />
            ML ranks anomalies; policy makes the decision
          </span>
        </footer>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
