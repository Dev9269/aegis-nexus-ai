import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, messageFromError } from "../services/api";
import type { Me } from "../types/api";

const ME_KEY = ["me"] as const;

interface AuthContextValue {
  me: Me | null;
  isLoading: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  loginError: string | null;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  clearLoginError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionNotice, setSessionNotice] = useState(false);

  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: api.me,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_KEY, data);
      setSessionNotice(false);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
      queryClient.setQueryData(ME_KEY, null);
      setSessionNotice(false);
    },
  });

  useEffect(() => {
    const onUnauthorized = () => {
      const current = queryClient.getQueryData<Me | null>(ME_KEY);
      if (current) {
        setSessionNotice(true);
      }
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
      queryClient.setQueryData(ME_KEY, null);
    };
    window.addEventListener("aegis:unauthorized", onUnauthorized);
    return () => window.removeEventListener("aegis:unauthorized", onUnauthorized);
  }, [queryClient]);

  useEffect(() => {
    if (sessionNotice) {
      try {
        sessionStorage.setItem("aegis.sessionNotice", "expired");
      } catch {
        // Session storage is optional.
      }
    }
  }, [sessionNotice]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        return await loginMutation.mutateAsync({ email, password });
      } catch (error) {
        throw new Error(messageFromError(error));
      }
    },
    [loginMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const me = meQuery.data ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      isLoading: meQuery.isLoading,
      isStaff: Boolean(me && me.role !== "EMPLOYEE"),
      login,
      logout,
      loginError: loginMutation.error ? messageFromError(loginMutation.error) : null,
      isLoggingIn: loginMutation.isPending,
      isLoggingOut: logoutMutation.isPending,
      clearLoginError: () => loginMutation.reset(),
    }),
    [
      me,
      meQuery.isLoading,
      login,
      logout,
      loginMutation.error,
      loginMutation.isPending,
      logoutMutation.isPending,
      loginMutation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export { ME_KEY };
