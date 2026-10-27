import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me } from "../../types/api";
import { getMe, login, logout } from "./api";
import { useAuthStore } from "./store";

export const ME_KEY = ["me"] as const;

export const authKeys = {
  me: ME_KEY,
};

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: getMe,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me, data);
      useAuthStore.getState().setSessionNotice(false);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
      queryClient.setQueryData(authKeys.me, null);
      useAuthStore.getState().setSessionNotice(false);
    },
  });
}

export function useAuthSessionBridge() {
  const queryClient = useQueryClient();
  const sessionNotice = useAuthStore((state) => state.sessionNotice);
  const setSessionNotice = useAuthStore((state) => state.setSessionNotice);

  useEffect(() => {
    const onUnauthorized = () => {
      const current = queryClient.getQueryData<Me | null>(authKeys.me);
      if (current) {
        setSessionNotice(true);
      }
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
      queryClient.setQueryData(authKeys.me, null);
    };
    window.addEventListener("aegis:unauthorized", onUnauthorized);
    return () => window.removeEventListener("aegis:unauthorized", onUnauthorized);
  }, [queryClient, setSessionNotice]);

  useEffect(() => {
    if (!sessionNotice) return;
    try {
      sessionStorage.setItem("aegis.sessionNotice", "expired");
    } catch {
      // Session storage is optional.
    }
  }, [sessionNotice]);
}
