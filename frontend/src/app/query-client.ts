import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/http";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    },
    mutations: { retry: false },
  },
});
