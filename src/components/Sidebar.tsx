import { useState } from "react";
import { useButtons, type ExtraPane } from "../state/buttons";
import { launchButton } from "../lib/launch";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { UpdaterButton } from "./UpdaterButton";
import { startTour } from "../lib/tour";
import {
  isRestoreEnabled,
  setRestoreEnabled,
  clearSavedSession,
} from "../lib/session";
import "./Sidebar.css";

type MenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
};

function safeString(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function Sidebar() {
  const config = useButtons((s) => s.config);
  const loaded = useButtons((s) => s.loaded);
  const collapsedGroups = useButtons((s) => s.collapsedGroups);
  const toggleGroup = useButtons((s) => s.toggleGroup);
  const openEditor = useButtons((s) => s.openEditor);
  const openButtonEditor = useButtons((s) => s.openButtonEditor);
  const removeButton = useButtons((s) => s.removeButton);
  const removeGroup = useButtons((s) => s.removeGroup);
  const updateGroup = useButtons((s) => s.updateGroup);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [restoreOn, setRestoreOn] = useState(isRestoreEnabled());

  const toggleRestore = () => {
    const next = !restoreOn;
    setRestoreEnabled(next);
    setRestoreOn(next);
  };

  const wipeSession = async () => {
    if (!confirm("Effacer la session sauvegardée ? Au prochain lancement tu repartiras d'un onglet vide.")) return;
    await clearSavedSession();
  };

  if (!loaded) {
    return (
      <aside className="sidebar">
        <div className="sidebar-loading">Loading…</div>
      </aside>
    );
  }

  const groups = safeArray<any>(config?.groups);

  const openButtonMenu = (
    e: React.MouseEvent,
    groupId: string,
    buttonId: string,
    label: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          kind: "item",
          label: "Éditer",
          onClick: () =>
            openButtonEditor({ mode: "edit", groupId, buttonId }),
        },
        { kind: "separator" },
        {
          kind: "item",
          label: "Supprimer",
          danger: true,
          onClick: () => {
            if (confirm(`Supprimer "${label}" ?`)) removeButton(groupId, buttonId);
          },
        },
      ],
    });
  };

  const openGroupMenu = (
    e: React.MouseEvent,
    groupId: string,
    groupLabel: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          kind: "item",
          label: "+ Nouveau bouton",
          onClick: () => openButtonEditor({ mode: "new", groupId }),
        },
        {
          kind: "item",
          label: "Renommer le groupe",
          onClick: () => {
            const newLabel = prompt("Nouveau nom du groupe", groupLabel);
            if (newLabel && newLabel.trim()) {
              updateGroup(groupId, { label: newLabel.trim() });
            }
          },
        },
        {
          kind: "item",
          label: "Changer l'icône",
          onClick: () => {
            const newIcon = prompt(
              "Nouvelle icône (emoji ou vide pour retirer)",
              "",
            );
            if (newIcon !== null) {
              updateGroup(groupId, { icon: newIcon.trim() || null });
            }
          },
        },
        { kind: "separator" },
        {
          kind: "item",
          label: "Supprimer le groupe",
          danger: true,
          onClick: () => {
            if (
              confirm(`Supprimer le groupe "${groupLabel}" et tous ses boutons ?`)
            )
              removeGroup(groupId);
          },
        },
      ],
    });
  };

  return (
    <aside className="sidebar" data-tour="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Tugboat</span>
        <button
          className="header-help-btn"
          onClick={() => startTour()}
          title="Relancer le tour"
          aria-label="Help"
        >
          ?
        </button>
      </div>
      <div className="sidebar-body">
        {groups.length === 0 && (
          <div className="sidebar-empty">
            Aucun bouton configuré.
            <br />
            Clique sur "+ Nouveau bouton" en bas.
          </div>
        )}
        {groups.map((group, gi) => {
          const groupId = safeString(group?.id) || `g${gi}`;
          const groupLabel = safeString(group?.label) || "(sans nom)";
          const groupIcon = safeString(group?.icon);
          const buttons = safeArray<any>(group?.buttons);
          const collapsed = collapsedGroups.has(groupId);
          return (
            <div key={groupId} className="group">
              <button
                className="group-header"
                onClick={() => toggleGroup(groupId)}
                onContextMenu={(e) => openGroupMenu(e, groupId, groupLabel)}
              >
                <span
                  className={`chevron ${collapsed ? "collapsed" : ""}`}
                />
                {groupIcon && (
                  <span className="group-icon">{groupIcon}</span>
                )}
                <span className="group-label">{groupLabel}</span>
                <span className="group-count">{buttons.length}</span>
              </button>
              {!collapsed && (
                <div className="group-buttons">
                  {buttons.map((btn, bi) => {
                    const btnId = safeString(btn?.id) || `b${gi}-${bi}`;
                    const btnLabel =
                      safeString(btn?.label) || "(sans label)";
                    const btnIcon = safeString(btn?.icon);
                    const command = safeString(btn?.command);
                    const args = safeArray<string>(btn?.args);
                    const cwd = safeString(btn?.cwd);
                    const openIn = safeString(btn?.openIn) || "tab";
                    const rawPanes = safeArray<any>(btn?.extraPanes);
                    const extraPanes: ExtraPane[] = rawPanes.map((p) => ({
                      dir: p?.dir === "v" ? "v" : "h",
                      command: safeString(p?.command),
                      args: safeArray<string>(p?.args),
                      cwd: safeString(p?.cwd) || null,
                      delayMs:
                        typeof p?.delayMs === "number" && p.delayMs > 0
                          ? p.delayMs
                          : null,
                      waitForText: safeString(p?.waitForText) || null,
                    }));
                    const paneCount = 1 + extraPanes.length;
                    const arrow =
                      openIn === "tab"
                        ? "⇥"
                        : openIn === "split-h"
                          ? "⇔"
                          : "⇕";
                    return (
                      <button
                        key={btnId}
                        className="launcher-btn"
                        title={`${command} ${args.join(" ")}${
                          cwd ? ` (in ${cwd})` : ""
                        }${paneCount > 1 ? ` · ${paneCount} panels` : ""}`}
                        onClick={() =>
                          launchButton({
                            id: btnId,
                            label: btnLabel,
                            icon: btnIcon || null,
                            command,
                            args,
                            cwd: cwd || null,
                            openIn: openIn as any,
                            extraPanes,
                          })
                        }
                        onContextMenu={(e) =>
                          openButtonMenu(e, groupId, btnId, btnLabel)
                        }
                      >
                        {btnIcon && (
                          <span className="btn-icon">{btnIcon}</span>
                        )}
                        <span className="btn-label">{btnLabel}</span>
                        {paneCount > 1 && (
                          <span className="btn-pane-count">{paneCount}</span>
                        )}
                        <span className={`btn-open-in ${openIn}`}>{arrow}</span>
                      </button>
                    );
                  })}
                  <button
                    className="add-btn-in-group"
                    onClick={() =>
                      openButtonEditor({ mode: "new", groupId })
                    }
                  >
                    + Ajouter un bouton
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="sidebar-footer">
        <button
          className="footer-btn primary"
          data-tour="new-btn"
          onClick={() => openButtonEditor({ mode: "new" })}
        >
          + Nouveau bouton
        </button>
        <button
          className="footer-btn"
          data-tour="json-btn"
          onClick={openEditor}
          title="Éditer le JSON brut"
        >
          buttons.json
        </button>

        <div className="pref-row">
          <label className="pref-toggle" title="Restaure les onglets et splits au prochain lancement">
            <input
              type="checkbox"
              checked={restoreOn}
              onChange={toggleRestore}
            />
            <span>Restaurer la session</span>
          </label>
          <button
            className="pref-mini"
            onClick={wipeSession}
            title="Effacer la session sauvegardée"
          >
            🗑
          </button>
        </div>

        <UpdaterButton />
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}
