import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";
import { useTabs, type PaneNode, type Tab } from "../state/tabs";

const PREF_KEY = "tugboat.restoreSession";

export function isRestoreEnabled(): boolean {
  const v = localStorage.getItem(PREF_KEY);
  return v === null ? true : v === "1";
}

export function setRestoreEnabled(enabled: boolean) {
  localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
}

function normalizeLeaves(node: PaneNode): PaneNode {
  if (node.kind === "leaf") {
    return { ...node, ptyId: nanoid(12), waiting: null };
  }
  return {
    ...node,
    a: normalizeLeaves(node.a),
    b: normalizeLeaves(node.b),
  };
}

type SavedSession = {
  tabs: Tab[];
  activeTabId: string | null;
};

export async function hydrateSession(): Promise<boolean> {
  if (!isRestoreEnabled()) return false;
  try {
    const raw = await invoke<string | null>("session_load");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SavedSession;
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return false;

    const tabs: Tab[] = parsed.tabs.map((t) => ({
      ...t,
      root: normalizeLeaves(t.root),
    }));

    useTabs.setState({
      tabs,
      activeTabId: parsed.activeTabId ?? tabs[0].id,
    });
    return true;
  } catch (err) {
    console.error("Failed to restore session:", err);
    return false;
  }
}

let saveTimer: number | null = null;
let unsubscribe: (() => void) | null = null;

export function installSessionAutosave() {
  if (unsubscribe) unsubscribe();

  const doSave = () => {
    saveTimer = null;
    const s = useTabs.getState();
    const payload: SavedSession = {
      tabs: s.tabs,
      activeTabId: s.activeTabId,
    };
    invoke("session_save", { json: JSON.stringify(payload) }).catch(() => {});
  };

  unsubscribe = useTabs.subscribe(() => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = window.setTimeout(doSave, 300);
  });
}

export async function clearSavedSession() {
  try {
    await invoke("session_clear");
  } catch (err) {
    console.error("Failed to clear session:", err);
  }
}
