import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type OpenIn = "tab" | "split-h" | "split-v";

export type ButtonCfg = {
  id: string;
  label: string;
  icon?: string | null;
  command: string;
  args: string[];
  cwd?: string | null;
  openIn: OpenIn;
};

export type GroupCfg = {
  id: string;
  label: string;
  icon?: string | null;
  buttons: ButtonCfg[];
};

export type ButtonsConfig = {
  version: number;
  groups: GroupCfg[];
};

type Store = {
  config: ButtonsConfig;
  loaded: boolean;
  configPath: string | null;
  editorOpen: boolean;
  hydrate: () => Promise<void>;
  save: () => Promise<void>;
  setConfig: (config: ButtonsConfig) => void;
  toggleGroup: (groupId: string) => void;
  openEditor: () => void;
  closeEditor: () => void;
  collapsedGroups: Set<string>;
};

const emptyConfig: ButtonsConfig = { version: 1, groups: [] };

export const useButtons = create<Store>((set, get) => ({
  config: emptyConfig,
  loaded: false,
  configPath: null,
  editorOpen: false,
  collapsedGroups: new Set(),

  openEditor: () => set({ editorOpen: true }),
  closeEditor: () => set({ editorOpen: false }),

  hydrate: async () => {
    try {
      const [config, configPath] = await Promise.all([
        invoke<ButtonsConfig>("config_load"),
        invoke<string>("config_path"),
      ]);
      set({ config, configPath, loaded: true });
    } catch (err) {
      console.error("Failed to load config:", err);
      set({ loaded: true });
    }
  },

  save: async () => {
    const { config } = get();
    try {
      await invoke("config_save", { config });
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  },

  setConfig: (config) => set({ config }),

  toggleGroup: (groupId) =>
    set((s) => {
      const next = new Set(s.collapsedGroups);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return { collapsedGroups: next };
    }),
}));
