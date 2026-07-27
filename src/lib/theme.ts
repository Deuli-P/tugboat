import type { ThemeMode } from "../state/ui";

const CUSTOM_KEY = "tugboat.customColors";

type ResolvedTheme = "light" | "dark";

export type CustomColors = {
  background?: string;
  text?: string;
  button?: string;
};

export function readCustomColors(): CustomColors {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      background: typeof parsed.background === "string" ? parsed.background : undefined,
      text: typeof parsed.text === "string" ? parsed.text : undefined,
      button: typeof parsed.button === "string" ? parsed.button : undefined,
    };
  } catch {
    return {};
  }
}

export function writeCustomColors(colors: CustomColors) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(colors));
  } catch {
    // ignore
  }
}

export function clearCustomColors() {
  try {
    localStorage.removeItem(CUSTOM_KEY);
  } catch {
    // ignore
  }
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return mode;
}

function applyResolved(resolved: ResolvedTheme, custom: CustomColors) {
  const root = document.documentElement;
  root.dataset.theme = resolved;

  const base =
    resolved === "light"
      ? {
          bg: "#f7f8fa",
          panelBg: "#ffffff",
          sidebarBg: "#eef1f6",
          tabbarBg: "#eef1f6",
          text: "#1a1b26",
          muted: "#565f89",
          border: "#d5d9e2",
          accent: "#3b7dd8",
          terminalBg: "#ffffff",
          inputBg: "#ffffff",
        }
      : {
          bg: "#1a1b26",
          panelBg: "#1a1b26",
          sidebarBg: "#15161e",
          tabbarBg: "#15161e",
          text: "#c0caf5",
          muted: "#565f89",
          border: "#24283b",
          accent: "#7aa2f7",
          terminalBg: "#1a1b26",
          inputBg: "#15161e",
        };

  const bg = custom.background || base.bg;
  const text = custom.text || base.text;
  const accent = custom.button || base.accent;

  root.style.setProperty("--bg", bg);
  root.style.setProperty("--panel-bg", base.panelBg);
  root.style.setProperty("--sidebar-bg", base.sidebarBg);
  root.style.setProperty("--tabbar-bg", base.tabbarBg);
  root.style.setProperty("--text", text);
  root.style.setProperty("--muted", base.muted);
  root.style.setProperty("--border", base.border);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--terminal-bg", custom.background || base.terminalBg);
  root.style.setProperty("--input-bg", base.inputBg);
}

export function applyTheme(mode: ThemeMode): () => void {
  const custom = readCustomColors();
  applyResolved(resolveMode(mode), custom);

  if (mode !== "system") return () => {};

  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => applyResolved(resolveMode(mode), readCustomColors());
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

export function reapplyWithCustomColors(mode: ThemeMode) {
  applyResolved(resolveMode(mode), readCustomColors());
}
