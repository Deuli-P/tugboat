import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { SplitContainer } from "./components/SplitContainer";
import { ConfigEditor } from "./components/ConfigEditor";
import { ButtonEditor } from "./components/ButtonEditor";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { useTabs } from "./state/tabs";
import { useButtons } from "./state/buttons";
import { useUI } from "./state/ui";
import { applyTheme } from "./lib/theme";
import { maybeStartTourOnBoot } from "./lib/tour";
import { hydrateSession, installSessionAutosave } from "./lib/session";
import "./App.css";

function App() {
  const tabs = useTabs((s) => s.tabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  const addTab = useTabs((s) => s.addTab);
  const closeTab = useTabs((s) => s.closeTab);
  const splitPane = useTabs((s) => s.splitPane);
  const closePane = useTabs((s) => s.closePane);
  const hydrate = useButtons((s) => s.hydrate);
  const editorOpen = useButtons((s) => s.editorOpen);
  const closeEditor = useButtons((s) => s.closeEditor);
  const sidebarCollapsed = useUI((s) => s.sidebarCollapsed);
  const themeMode = useUI((s) => s.themeMode);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    hydrate();
    hydrateSession().finally(() => {
      installSessionAutosave();
      maybeStartTourOnBoot();
    });
  }, [hydrate]);

  useEffect(() => {
    const cleanup = applyTheme(themeMode);
    return cleanup;
  }, [themeMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      const state = useTabs.getState();
      const tab = state.tabs.find((t) => t.id === state.activeTabId);
      if (!tab) return;

      const key = e.key.toLowerCase();

      if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (key === "t" && !e.shiftKey) {
        e.preventDefault();
        addTab();
      } else if (key === "w" && !e.shiftKey) {
        e.preventDefault();
        closePane(tab.id, tab.activeLeafId);
      } else if (key === "d" && !e.shiftKey) {
        e.preventDefault();
        splitPane(tab.id, tab.activeLeafId, "h");
      } else if (key === "d" && e.shiftKey) {
        e.preventDefault();
        splitPane(tab.id, tab.activeLeafId, "v");
      } else if (key === "q" && !e.shiftKey) {
        e.preventDefault();
        closeTab(tab.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addTab, closeTab, splitPane, closePane]);

  return (
    <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {!sidebarCollapsed && <Sidebar />}
      <div className="main">
        <TabBar />
        <div className="tab-content">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-panel ${tab.id === activeTabId ? "active" : ""}`}
              aria-hidden={tab.id !== activeTabId}
            >
              <SplitContainer tab={tab} node={tab.root} />
            </div>
          ))}
        </div>
      </div>
      <ConfigEditor open={editorOpen} onClose={closeEditor} />
      <ButtonEditor />
      <SettingsModal />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

export default App;
