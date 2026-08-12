import { create } from "zustand";

export type PtyStatus = "running" | "exited";

type Store = {
  status: Record<string, PtyStatus>;
  setRunning: (ptyId: string) => void;
  setExited: (ptyId: string) => void;
  clear: (ptyId: string) => void;
};

export const usePtyStatus = create<Store>((set) => ({
  status: {},

  setRunning: (ptyId) =>
    set((s) => ({ status: { ...s.status, [ptyId]: "running" } })),

  setExited: (ptyId) =>
    set((s) => ({ status: { ...s.status, [ptyId]: "exited" } })),

  clear: (ptyId) =>
    set((s) => {
      if (!(ptyId in s.status)) return s;
      const next = { ...s.status };
      delete next[ptyId];
      return { status: next };
    }),
}));
