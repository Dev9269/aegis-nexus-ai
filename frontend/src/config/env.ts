const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
const wsPath = import.meta.env.VITE_WS_PATH ?? "/api/ws/events";
const explicitlyEnabled = import.meta.env.VITE_DEMO_MODE === "true";
const explicitlyDisabled = import.meta.env.VITE_DEMO_MODE === "false";
const demoEnabled = explicitlyEnabled || (import.meta.env.DEV && !explicitlyDisabled);
const demoPassword =
  import.meta.env.VITE_DEMO_PASSWORD ??
  (import.meta.env.DEV && demoEnabled ? "ChangeMe-Demo!2026" : "");

export const env = Object.freeze({ apiBase, wsPath, demoEnabled, demoPassword });

export function websocketUrl(): string {
  if (wsPath.startsWith("ws://") || wsPath.startsWith("wss://")) return wsPath;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${wsPath}`;
}
