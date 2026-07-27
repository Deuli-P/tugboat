import { create } from "zustand";

type ThemeMode = "light" | "dark" | "system";

type UIState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
};

const SIDEBAR_KEY = "tugboat.sidebarCollapsed";
const THEME_KEY = "tugboat.themeMode";

function readSidebar(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "dark";
}

export const useUI = create<UIState>((set, get) => ({
  sidebarCollapsed: readSidebar(),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    set({ sidebarCollapsed: next });
  },
  setSidebarCollapsed: (v) => {
    try {
      localStorage.setItem(SIDEBAR_KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
    set({ sidebarCollapsed: v });
  },

  themeMode: readTheme(),
  setThemeMode: (mode) => {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // ignore
    }
    set({ themeMode: mode });
  },

  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));

export type { ThemeMode };
