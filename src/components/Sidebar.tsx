import { useButtons } from "../state/buttons";
import { launchButton } from "../lib/launch";
import "./Sidebar.css";

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

  if (!loaded) {
    return (
      <aside className="sidebar">
        <div className="sidebar-loading">Loading…</div>
      </aside>
    );
  }

  const groups = safeArray<any>(config?.groups);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Tugboat</span>
      </div>
      <div className="sidebar-body">
        {groups.length === 0 && (
          <div className="sidebar-empty">
            Aucun bouton configuré.
            <br />
            Édite le fichier ci-dessous.
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
                        }`}
                        onClick={() =>
                          launchButton({
                            id: btnId,
                            label: btnLabel,
                            icon: btnIcon || null,
                            command,
                            args,
                            cwd: cwd || null,
                            openIn: openIn as any,
                          })
                        }
                      >
                        {btnIcon && (
                          <span className="btn-icon">{btnIcon}</span>
                        )}
                        <span className="btn-label">{btnLabel}</span>
                        <span className={`btn-open-in ${openIn}`}>{arrow}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="sidebar-footer">
        <button
          className="footer-btn"
          onClick={openEditor}
          title="Ouvrir l'éditeur de configuration"
        >
          Éditer buttons.json
        </button>
      </div>
    </aside>
  );
}
