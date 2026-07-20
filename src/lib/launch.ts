import { listen } from "@tauri-apps/api/event";
import { useTabs, findLeaf } from "../state/tabs";
import type { ButtonCfg, ExtraPane } from "../state/buttons";

async function waitForPtyText(
  ptyId: string,
  needle: string,
  timeoutMs = 120000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let buffer = "";
    let unlisten: (() => void) | null = null;
    let done = false;
    const stripAnsi = (s: string) =>
      s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      unlisten?.();
      reject(new Error(`Timeout waiting for "${needle}"`));
    }, timeoutMs);

    listen<string>(`pty:data:${ptyId}`, (evt) => {
      if (done) return;
      buffer += stripAnsi(evt.payload);
      if (buffer.length > 65536) {
        buffer = buffer.slice(-32768);
      }
      if (buffer.includes(needle)) {
        done = true;
        clearTimeout(timer);
        unlisten?.();
        resolve();
      }
    })
      .then((fn) => {
        if (done) fn();
        else unlisten = fn;
      })
      .catch(reject);
  });
}

function activeLeafPtyId(): string | null {
  const s = useTabs.getState();
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  if (!tab) return null;
  const leaf = findLeaf(tab.root, tab.activeLeafId);
  return leaf?.ptyId ?? null;
}

function buildWaitingMessage(pane: ExtraPane): string {
  const parts: string[] = [];
  if (pane.waitForText) {
    parts.push(`texte « ${pane.waitForText} »`);
  }
  if (pane.delayMs && pane.delayMs > 0) {
    parts.push(`délai ${pane.delayMs} ms`);
  }
  if (parts.length === 0) return "";
  return `⏳ En attente : ${parts.join(" + ")}`;
}

export async function launchButton(button: ButtonCfg) {
  const rootSpawn = {
    command: button.command,
    args: button.args,
    cwd: button.cwd ?? null,
  };

  const state = useTabs.getState();

  if (button.openIn === "tab") {
    state.addTab({ title: button.label, spawn: rootSpawn });
  } else {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) {
      state.addTab({ title: button.label, spawn: rootSpawn });
    } else {
      const dir = button.openIn === "split-h" ? "h" : "v";
      state.splitPane(tab.id, tab.activeLeafId, dir, rootSpawn);
    }
  }

  const extraPanes = button.extraPanes ?? [];
  if (extraPanes.length === 0) return;

  type Scheduled = {
    leafId: string;
    prevPtyId: string | null;
    delayMs: number | null;
    waitForText: string | null;
  };

  const schedule: Scheduled[] = [];
  let prevPtyId = activeLeafPtyId();

  for (const pane of extraPanes) {
    const waiting = buildWaitingMessage(pane);
    const spawn = {
      command: pane.command,
      args: pane.args,
      cwd: pane.cwd ?? button.cwd ?? null,
      waiting: waiting || null,
    };

    const s = useTabs.getState();
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) break;
    s.splitPane(tab.id, tab.activeLeafId, pane.dir, spawn);

    const s2 = useTabs.getState();
    const tab2 = s2.tabs.find((t) => t.id === s2.activeTabId);
    if (!tab2) break;

    const newLeafId = tab2.activeLeafId;
    const newLeaf = findLeaf(tab2.root, newLeafId);
    schedule.push({
      leafId: newLeafId,
      prevPtyId,
      delayMs: pane.delayMs ?? null,
      waitForText: pane.waitForText ?? null,
    });
    prevPtyId = newLeaf?.ptyId ?? null;
  }

  for (const step of schedule) {
    if (step.waitForText && step.prevPtyId) {
      try {
        await waitForPtyText(step.prevPtyId, step.waitForText);
      } catch (err) {
        console.error("waitForText failed:", err);
      }
    }
    if (step.delayMs && step.delayMs > 0) {
      await new Promise((r) => setTimeout(r, step.delayMs!));
    }
    useTabs.getState().clearLeafWaiting(step.leafId);
  }
}
