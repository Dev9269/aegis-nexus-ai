import { Suspense, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "../features/toast/Toaster";
import { useAuthSessionBridge } from "../features/auth/queries";
import { useTheme } from "../features/preferences/useTheme";
import { queryClient } from "./query-client";
import { AppErrorBoundary } from "./error-boundary";
import { BootSplash } from "./layout/BootSplash";

function SessionBridge() {
  useAuthSessionBridge();
  return null;
}

function ThemeBootstrap() {
  useTheme();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBridge />
      <ThemeBootstrap />
      <AppErrorBoundary>
        <Suspense fallback={<BootSplash />}>{children}</Suspense>
      </AppErrorBoundary>
      <Toaster />
    </QueryClientProvider>
  );
}
