import { useTabs } from "../state/tabs";
import type { ButtonCfg } from "../state/buttons";

export function launchButton(button: ButtonCfg) {
  const state = useTabs.getState();
  const spawn = {
    command: button.command,
    args: button.args,
    cwd: button.cwd ?? null,
  };

  if (button.openIn === "tab") {
    state.addTab({ title: button.label, spawn });
    return;
  }

  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (!tab) {
    state.addTab({ title: button.label, spawn });
    return;
  }

  const dir = button.openIn === "split-h" ? "h" : "v";
  state.splitPane(tab.id, tab.activeLeafId, dir, spawn);
}
