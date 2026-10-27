import { create } from "zustand";
import { safeStorage } from "../../lib/storage";

export type Theme = "dark" | "light";

interface PreferencesState {
  theme: Theme;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (value: boolean) => void;
}

const THEME_KEY = "aegis.theme";
const SIDEBAR_KEY = "aegis.sidebarCollapsed";

function initialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function initialSidebarCollapsed(): boolean {
  return safeStorage.get(SIDEBAR_KEY) === "true";
}

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  theme: initialTheme(),
  sidebarCollapsed: initialSidebarCollapsed(),
  setTheme: (theme) => {
    safeStorage.set(THEME_KEY, theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  setSidebarCollapsed: (sidebarCollapsed) => {
    safeStorage.set(SIDEBAR_KEY, String(sidebarCollapsed));
    set({ sidebarCollapsed });
  },
}));
