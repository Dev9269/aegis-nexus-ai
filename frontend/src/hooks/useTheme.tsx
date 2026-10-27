import type { ReactNode } from "react";
import { useTheme as useFeatureTheme } from "../features/preferences/useTheme";

export { useTheme } from "../features/preferences/useTheme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useFeatureTheme();
  return <>{children}</>;
}
