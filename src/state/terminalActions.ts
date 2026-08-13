import { create } from "zustand";

type Store = {
  resetters: Record<string, () => void>;
  register: (ptyId: string, fn: () => void) => void;
  unregister: (ptyId: string) => void;
  reset: (ptyId: string) => void;
};

export const useTerminalActions = create<Store>((set, get) => ({
  resetters: {},

  register: (ptyId, fn) =>
    set((s) => ({ resetters: { ...s.resetters, [ptyId]: fn } })),

  unregister: (ptyId) =>
    set((s) => {
      if (!(ptyId in s.resetters)) return s;
      const next = { ...s.resetters };
      delete next[ptyId];
      return { resetters: next };
    }),

  reset: (ptyId) => get().resetters[ptyId]?.(),
}));
