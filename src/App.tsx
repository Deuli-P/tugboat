import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { SplitContainer } from "./components/SplitContainer";
import { ConfigEditor } from "./components/ConfigEditor";
import { ButtonEditor } from "./components/ButtonEditor";
import { CommandPalette } from "./components/CommandPalette";
import { useTabs } from "./state/tabs";
import { useButtons } from "./state/buttons";
import { maybeStartTourOnBoot } from "./lib/tour";
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
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    hydrate();
    maybeStartTourOnBoot();
  }, [hydrate]);

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
    <div className="app">
      <Sidebar />
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
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

export default App;
