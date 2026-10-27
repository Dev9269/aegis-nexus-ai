import { create } from "zustand";

interface AuthState {
  sessionNotice: boolean;
  setSessionNotice: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  sessionNotice: false,
  setSessionNotice: (sessionNotice) => set({ sessionNotice }),
}));
