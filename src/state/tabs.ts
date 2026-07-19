import { create } from "zustand";
import { nanoid } from "nanoid";

export type SplitDir = "h" | "v";

export type SpawnConfig = {
  command?: string;
  args?: string[];
  cwd?: string | null;
};

export type LeafNode = {
  kind: "leaf";
  id: string;
  ptyId: string;
  command: string;
  args: string[];
  cwd: string | null;
};

export type SplitNode = {
  kind: "split";
  id: string;
  dir: SplitDir;
  ratio: number;
  a: PaneNode;
  b: PaneNode;
};

export type PaneNode = LeafNode | SplitNode;

export type Tab = {
  id: string;
  title: string;
  root: PaneNode;
  activeLeafId: string;
};

type AddTabOpts = {
  title?: string;
  spawn?: SpawnConfig;
};

type Store = {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (opts?: AddTabOpts) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setActiveLeaf: (tabId: string, leafId: string) => void;
  splitPane: (
    tabId: string,
    leafId: string,
    dir: SplitDir,
    spawn?: SpawnConfig,
  ) => void;
  closePane: (tabId: string, leafId: string) => void;
  setRatio: (tabId: string, splitId: string, ratio: number) => void;
  renameTab: (tabId: string, title: string) => void;
};

function makeLeaf(spawn?: SpawnConfig): LeafNode {
  return {
    kind: "leaf",
    id: nanoid(8),
    ptyId: nanoid(12),
    command: spawn?.command ?? "",
    args: spawn?.args ?? [],
    cwd: spawn?.cwd ?? null,
  };
}

function makeTab(index: number, opts?: AddTabOpts): Tab {
  const leaf = makeLeaf(opts?.spawn);
  return {
    id: nanoid(8),
    title: opts?.title ?? `shell ${index}`,
    root: leaf,
    activeLeafId: leaf.id,
  };
}

function findLeaves(node: PaneNode): LeafNode[] {
  if (node.kind === "leaf") return [node];
  return [...findLeaves(node.a), ...findLeaves(node.b)];
}

function transform(
  node: PaneNode,
  fn: (leaf: LeafNode) => PaneNode | null,
): PaneNode | null {
  if (node.kind === "leaf") return fn(node);
  const newA = transform(node.a, fn);
  const newB = transform(node.b, fn);
  if (!newA && !newB) return null;
  if (!newA) return newB;
  if (!newB) return newA;
  return { ...node, a: newA, b: newB };
}

function updateSplitRatio(
  node: PaneNode,
  splitId: string,
  ratio: number,
): PaneNode {
  if (node.kind === "leaf") return node;
  if (node.id === splitId) return { ...node, ratio };
  return {
    ...node,
    a: updateSplitRatio(node.a, splitId, ratio),
    b: updateSplitRatio(node.b, splitId, ratio),
  };
}

const initialTab = makeTab(1);

export const useTabs = create<Store>((set) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  addTab: (opts) =>
    set((s) => {
      const tab = makeTab(s.tabs.length + 1, opts);
      return { tabs: [...s.tabs, tab], activeTabId: tab.id };
    }),

  closeTab: (tabId) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return s;
      const tabs = s.tabs.filter((t) => t.id !== tabId);
      if (tabs.length === 0) {
        const tab = makeTab(1);
        return { tabs: [tab], activeTabId: tab.id };
      }
      const activeTabId =
        s.activeTabId === tabId
          ? tabs[Math.min(idx, tabs.length - 1)].id
          : s.activeTabId;
      return { tabs, activeTabId };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setActiveLeaf: (tabId, leafId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, activeLeafId: leafId } : t,
      ),
    })),

  splitPane: (tabId, leafId, dir, spawn) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const newLeaf = makeLeaf(spawn);
        const replaceWith = (leaf: LeafNode): SplitNode => ({
          kind: "split",
          id: nanoid(8),
          dir,
          ratio: 0.5,
          a: leaf,
          b: newLeaf,
        });
        const root = transform(t.root, (leaf) =>
          leaf.id === leafId ? replaceWith(leaf) : leaf,
        );
        return {
          ...t,
          root: root ?? makeLeaf(),
          activeLeafId: newLeaf.id,
        };
      }),
    })),

  closePane: (tabId, leafId) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      const remaining = findLeaves(tab.root).filter((l) => l.id !== leafId);
      if (remaining.length === 0) {
        return {
          tabs: s.tabs.filter((t) => t.id !== tabId),
          activeTabId:
            s.activeTabId === tabId
              ? s.tabs.find((t) => t.id !== tabId)?.id ?? null
              : s.activeTabId,
        };
      }
      const root = transform(tab.root, (leaf) =>
        leaf.id === leafId ? null : leaf,
      );
      return {
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                root: root ?? makeLeaf(),
                activeLeafId:
                  t.activeLeafId === leafId
                    ? remaining[0].id
                    : t.activeLeafId,
              }
            : t,
        ),
      };
    }),

  setRatio: (tabId, splitId, ratio) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? { ...t, root: updateSplitRatio(t.root, splitId, ratio) }
          : t,
      ),
    })),

  renameTab: (tabId, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    })),
}));

export function useActiveTab(): Tab | null {
  return useTabs((s) =>
    s.tabs.find((t) => t.id === s.activeTabId) ?? null,
  );
}

export { findLeaves };
