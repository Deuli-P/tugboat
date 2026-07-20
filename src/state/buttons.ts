import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";

export type OpenIn = "tab" | "split-h" | "split-v";

export type ExtraPane = {
  dir: "h" | "v";
  command: string;
  args: string[];
  cwd?: string | null;
  delayMs?: number | null;
  waitForText?: string | null;
};

export type ButtonCfg = {
  id: string;
  label: string;
  icon?: string | null;
  command: string;
  args: string[];
  cwd?: string | null;
  openIn: OpenIn;
  extraPanes?: ExtraPane[];
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

export type ButtonEditorTarget =
  | { mode: "new"; groupId?: string }
  | { mode: "edit"; groupId: string; buttonId: string };

type Store = {
  config: ButtonsConfig;
  loaded: boolean;
  configPath: string | null;
  editorOpen: boolean;
  buttonEditor: ButtonEditorTarget | null;
  collapsedGroups: Set<string>;

  hydrate: () => Promise<void>;
  save: () => Promise<void>;
  setConfig: (config: ButtonsConfig) => void;

  toggleGroup: (groupId: string) => void;
  openEditor: () => void;
  closeEditor: () => void;

  openButtonEditor: (target: ButtonEditorTarget) => void;
  closeButtonEditor: () => void;

  addGroup: (group: Omit<GroupCfg, "id" | "buttons">) => string;
  updateGroup: (id: string, patch: Partial<Omit<GroupCfg, "id" | "buttons">>) => void;
  removeGroup: (id: string) => void;

  addButton: (groupId: string, button: Omit<ButtonCfg, "id">) => string;
  updateButton: (
    groupId: string,
    buttonId: string,
    patch: Partial<Omit<ButtonCfg, "id">>,
  ) => void;
  removeButton: (groupId: string, buttonId: string) => void;
  moveButton: (
    fromGroupId: string,
    buttonId: string,
    toGroupId: string,
  ) => void;
};

const emptyConfig: ButtonsConfig = { version: 1, groups: [] };

export const useButtons = create<Store>((set, get) => ({
  config: emptyConfig,
  loaded: false,
  configPath: null,
  editorOpen: false,
  buttonEditor: null,
  collapsedGroups: new Set(),

  openEditor: () => set({ editorOpen: true }),
  closeEditor: () => set({ editorOpen: false }),

  openButtonEditor: (target) => set({ buttonEditor: target }),
  closeButtonEditor: () => set({ buttonEditor: null }),

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

  addGroup: (group) => {
    const id = nanoid(8);
    set((s) => ({
      config: {
        ...s.config,
        groups: [
          ...s.config.groups,
          { id, label: group.label, icon: group.icon ?? null, buttons: [] },
        ],
      },
    }));
    void get().save();
    return id;
  },

  updateGroup: (id, patch) => {
    set((s) => ({
      config: {
        ...s.config,
        groups: s.config.groups.map((g) =>
          g.id === id ? { ...g, ...patch } : g,
        ),
      },
    }));
    void get().save();
  },

  removeGroup: (id) => {
    set((s) => ({
      config: {
        ...s.config,
        groups: s.config.groups.filter((g) => g.id !== id),
      },
    }));
    void get().save();
  },

  addButton: (groupId, button) => {
    const id = nanoid(8);
    set((s) => ({
      config: {
        ...s.config,
        groups: s.config.groups.map((g) =>
          g.id === groupId
            ? { ...g, buttons: [...g.buttons, { id, ...button }] }
            : g,
        ),
      },
    }));
    void get().save();
    return id;
  },

  updateButton: (groupId, buttonId, patch) => {
    set((s) => ({
      config: {
        ...s.config,
        groups: s.config.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                buttons: g.buttons.map((b) =>
                  b.id === buttonId ? { ...b, ...patch } : b,
                ),
              }
            : g,
        ),
      },
    }));
    void get().save();
  },

  removeButton: (groupId, buttonId) => {
    set((s) => ({
      config: {
        ...s.config,
        groups: s.config.groups.map((g) =>
          g.id === groupId
            ? { ...g, buttons: g.buttons.filter((b) => b.id !== buttonId) }
            : g,
        ),
      },
    }));
    void get().save();
  },

  moveButton: (fromGroupId, buttonId, toGroupId) => {
    set((s) => {
      const src = s.config.groups.find((g) => g.id === fromGroupId);
      if (!src) return s;
      const btn = src.buttons.find((b) => b.id === buttonId);
      if (!btn) return s;
      return {
        config: {
          ...s.config,
          groups: s.config.groups.map((g) => {
            if (g.id === fromGroupId) {
              return { ...g, buttons: g.buttons.filter((b) => b.id !== buttonId) };
            }
            if (g.id === toGroupId) {
              return { ...g, buttons: [...g.buttons, btn] };
            }
            return g;
          }),
        },
      };
    });
    void get().save();
  },
}));
