import { lazy } from "react";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { ForbiddenState } from "../components/ui";
import { useAuth } from "../features/auth/useAuth";
import type { Role } from "../types/api";
import { AppShell } from "./layout/AppShell";
import { BootSplash } from "./layout/BootSplash";

const LoginPage = lazy(() => import("../features/auth/pages/LoginPage"));
const EmployeeHomePage = lazy(() => import("../features/employee/pages/EmployeeHomePage"));
const OverviewPage = lazy(() => import("../features/overview/pages/OverviewPage"));
const AccessDecisionsPage = lazy(() => import("../pages/AccessDecisionsPage"));
const IdentityPage = lazy(() => import("../pages/IdentityPage"));
const IdentityDetailPage = lazy(() => import("../pages/IdentityDetailPage"));
const BehaviorPage = lazy(() => import("../pages/BehaviorPage"));
const IncidentsPage = lazy(() => import("../pages/IncidentsPage"));
const TimelinePage = lazy(() => import("../pages/TimelinePage"));
const DevicesPage = lazy(() => import("../pages/DevicesPage"));
const PoliciesPage = lazy(() => import("../pages/PoliciesPage"));
const ModelPage = lazy(() => import("../pages/ModelPage"));
const AuditPage = lazy(() => import("../pages/AuditPage"));
const DemoPage = lazy(() => import("../features/demo/pages/DemoPage"));
const SettingsPage = lazy(() => import("../features/settings/pages/SettingsPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));

function homeForRole(role: Role): string {
  return role === "EMPLOYEE" ? "/me" : "/";
}

function RequireAuth() {
  const { me, isLoading } = useAuth();
  if (isLoading) return <BootSplash />;
  if (!me) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function LoginRoute() {
  const { me, isLoading } = useAuth();
  if (isLoading) return <BootSplash />;
  if (me) return <Navigate to={homeForRole(me.role)} replace />;
  return <LoginPage />;
}

function HomeRoute() {
  const { me } = useAuth();
  if (!me) return null;
  if (me.role === "EMPLOYEE") return <Navigate to="/me" replace />;
  return <OverviewPage />;
}

function RequireStaff() {
  const { isStaff } = useAuth();
  if (!isStaff) {
    return (
      <ForbiddenState message="This operations console is reserved for security staff. Your employee session can still use My Security and your own access history." />
    );
  }
  return <Outlet />;
}

function IdentityAccessRoute() {
  const { me, isStaff } = useAuth();
  const { identityId } = useParams<{ identityId: string }>();
  if (!isStaff && me?.id !== identityId) {
    return (
      <ForbiddenState message="You can only view your own identity dossier. Staff review is required for other identities." />
    );
  }
  return <IdentityDetailPage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomeRoute />} />
          <Route path="/me" element={<EmployeeHomePage />} />
          <Route path="/access" element={<AccessDecisionsPage />} />
          <Route path="/identities/:identityId" element={<IdentityAccessRoute />} />
          <Route element={<RequireStaff />}>
            <Route path="/identities" element={<IdentityPage />} />
            <Route path="/behavior" element={<BehaviorPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/events" element={<TimelinePage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/model" element={<ModelPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/demos" element={<DemoPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
