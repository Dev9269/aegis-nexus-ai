import type { ReactNode } from "react";
import { Toaster } from "../features/toast/Toaster";
import { toast, useToastStore, type ToastTone } from "../features/toast/store";

interface ToastActions {
  push: (tone: ToastTone, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const actions: ToastActions = {
  push: (tone, title, description) => useToastStore.getState().push(tone, title, description),
  success: toast.success,
  error: toast.error,
  info: toast.info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

export function useToast(): ToastActions {
  return actions;
}
