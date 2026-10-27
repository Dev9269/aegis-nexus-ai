import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}
interface ToastState {
  items: ToastItem[];
  push: (tone: ToastTone, title: string, description?: string) => void;
  remove: (id: number) => void;
}

let nextId = 0;
export const useToastStore = create<ToastState>()((set, get) => ({
  items: [],
  push: (tone, title, description) => {
    const id = ++nextId;
    set({ items: [...get().items.slice(-3), { id, tone, title, description }] });
    window.setTimeout(() => get().remove(id), 5200);
  },
  remove: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push("success", title, description),
  error: (title: string, description?: string) =>
    useToastStore.getState().push("error", title, description),
  info: (title: string, description?: string) =>
    useToastStore.getState().push("info", title, description),
};
