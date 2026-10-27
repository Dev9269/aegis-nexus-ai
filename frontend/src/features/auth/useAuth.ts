import { useCallback, useMemo } from "react";
import { messageFromError } from "../../services/api";
import type { Me } from "../../types/api";
import { useLogin, useLogout, useMe } from "./queries";

export interface AuthContextValue {
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

export function useAuth(): AuthContextValue {
  const meQuery = useMe();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

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
  const isLoading = meQuery.isPending;
  return useMemo<AuthContextValue>(
    () => ({
      me,
      isLoading,
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
      isLoading,
      login,
      logout,
      loginMutation.error,
      loginMutation.isPending,
      loginMutation,
      logoutMutation.isPending,
    ],
  );
}
