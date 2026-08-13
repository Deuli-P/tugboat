import { useState } from "react";
import { useTabs, findLeaves } from "../state/tabs";
import { useUI } from "../state/ui";
import { useTerminalActions } from "../state/terminalActions";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import "./TabBar.css";

export function TabBar() {
  const tabs = useTabs((s) => s.tabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  const setActiveTab = useTabs((s) => s.setActiveTab);
  const addTab = useTabs((s) => s.addTab);
  const closeTab = useTabs((s) => s.closeTab);
  const sidebarCollapsed = useUI((s) => s.sidebarCollapsed);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(
    null,
  );

  const resetActiveTerminal = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const leaf = findLeaves(tab.root).find((l) => l.id === tab.activeLeafId);
    if (!leaf) return;
    useTerminalActions.getState().reset(leaf.ptyId);
  };

  return (
    <div className="tab-bar" data-tour="tab-bar">
      {sidebarCollapsed && (
        <button
          className="tab-sidebar-show"
          onClick={toggleSidebar}
          title="Afficher la sidebar"
          aria-label="Show sidebar"
        >
          ›
        </button>
      )}
      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? "active" : ""}`}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeTab(tab.id);
              } else {
                setActiveTab(tab.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setActiveTab(tab.id);
              setCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
            }}
          >
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-add" onClick={() => addTab()} aria-label="New tab">
        +
      </button>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={[
            {
              kind: "item",
              label: "Réinitialiser le terminal",
              onClick: () => resetActiveTerminal(ctxMenu.tabId),
            } satisfies ContextMenuItem,
          ]}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
