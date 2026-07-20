import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  useButtons,
  type OpenIn,
  type ButtonEditorTarget,
  type ExtraPane,
} from "../state/buttons";
import { parseCommandLine, serializeCommandLine } from "../lib/shellParse";
import "./ButtonEditor.css";

const NEW_GROUP_VALUE = "__new__";

export function ButtonEditor() {
  const target = useButtons((s) => s.buttonEditor);
  const close = useButtons((s) => s.closeButtonEditor);
  if (!target) return null;
  return <ButtonEditorInner target={target} onClose={close} />;
}

function ButtonEditorInner({
  target,
  onClose,
}: {
  target: ButtonEditorTarget;
  onClose: () => void;
}) {
  const config = useButtons((s) => s.config);
  const addGroup = useButtons((s) => s.addGroup);
  const addButton = useButtons((s) => s.addButton);
  const updateButton = useButtons((s) => s.updateButton);
  const removeButton = useButtons((s) => s.removeButton);

  const existing = useMemo(() => {
    if (target.mode !== "edit") return null;
    const g = config.groups.find((g) => g.id === target.groupId);
    if (!g) return null;
    const b = g.buttons.find((b) => b.id === target.buttonId);
    return b ?? null;
  }, [target, config]);

  const [label, setLabel] = useState(existing?.label ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "");
  const [commandLine, setCommandLine] = useState(() =>
    existing
      ? serializeCommandLine(existing.command, existing.args)
      : "",
  );
  const [cwd, setCwd] = useState(existing?.cwd ?? "");
  const [openIn, setOpenIn] = useState<OpenIn>(existing?.openIn ?? "tab");

  type UIExtraPane = {
    dir: "h" | "v";
    commandLine: string;
    cwd: string;
    delayMs: string;
    waitForText: string;
  };
  const [extraPanes, setExtraPanes] = useState<UIExtraPane[]>(() =>
    (existing?.extraPanes ?? []).map((p) => ({
      dir: p.dir,
      commandLine: serializeCommandLine(p.command, p.args),
      cwd: p.cwd ?? "",
      delayMs: p.delayMs ? String(p.delayMs) : "",
      waitForText: p.waitForText ?? "",
    })),
  );

  const parsedTokens = useMemo(
    () => parseCommandLine(commandLine),
    [commandLine],
  );

  const addExtraPane = () =>
    setExtraPanes((p) => [
      ...p,
      { dir: "h", commandLine: "", cwd: "", delayMs: "", waitForText: "" },
    ]);
  const removeExtraPane = (i: number) =>
    setExtraPanes((p) => p.filter((_, idx) => idx !== i));
  const updateExtraPane = (i: number, patch: Partial<UIExtraPane>) =>
    setExtraPanes((p) =>
      p.map((pane, idx) => (idx === i ? { ...pane, ...patch } : pane)),
    );
  const pickExtraCwd = async (i: number) => {
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: extraPanes[i].cwd || cwd || undefined,
      });
      if (typeof picked === "string") {
        updateExtraPane(i, { cwd: picked });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const initialGroupId =
    target.mode === "edit"
      ? target.groupId
      : target.groupId ?? config.groups[0]?.id ?? NEW_GROUP_VALUE;
  const [groupId, setGroupId] = useState<string>(initialGroupId);
  const [newGroupLabel, setNewGroupLabel] = useState("");

  const isEdit = target.mode === "edit";
  const canSave =
    label.trim().length > 0 &&
    parsedTokens.length > 0 &&
    (groupId !== NEW_GROUP_VALUE || newGroupLabel.trim().length > 0);

  const pickCwd = async () => {
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: cwd || undefined,
      });
      if (typeof picked === "string") {
        setCwd(picked);
      }
    } catch (err) {
      console.error("Folder picker failed:", err);
    }
  };

  const handleSubmit = () => {
    if (!canSave) return;
    let targetGroupId = groupId;
    if (targetGroupId === NEW_GROUP_VALUE) {
      targetGroupId = addGroup({ label: newGroupLabel.trim(), icon: null });
    }
    const [cmd, ...cmdArgs] = parsedTokens;
    const builtExtraPanes: ExtraPane[] = extraPanes.map((p) => {
      const tokens = parseCommandLine(p.commandLine);
      const parsedDelay = parseInt(p.delayMs, 10);
      return {
        dir: p.dir,
        command: tokens[0] ?? "",
        args: tokens.slice(1),
        cwd: p.cwd.trim() || null,
        delayMs:
          Number.isFinite(parsedDelay) && parsedDelay > 0
            ? parsedDelay
            : null,
        waitForText: p.waitForText.trim() || null,
      };
    });
    const payload = {
      label: label.trim(),
      icon: icon.trim() || null,
      command: cmd,
      args: cmdArgs,
      cwd: cwd.trim() || null,
      openIn,
      extraPanes: builtExtraPanes,
    };
    if (isEdit) {
      updateButton(target.groupId, target.buttonId, payload);
    } else {
      addButton(targetGroupId, payload);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!isEdit) return;
    if (!confirm(`Supprimer le bouton "${label}" ?`)) return;
    removeButton(target.groupId, target.buttonId);
    onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  });

  return (
    <div className="btn-editor-backdrop" onMouseDown={onClose}>
      <div
        className="btn-editor-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="btn-editor-header">
          <span className="btn-editor-title">
            {isEdit ? "Éditer le bouton" : "Nouveau bouton"}
          </span>
          <button className="btn-editor-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="btn-editor-body">
          <div className="field-row">
            <label className="field icon-field">
              <span className="label">Icône</span>
              <input
                type="text"
                value={icon ?? ""}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🚀"
                maxLength={4}
              />
            </label>
            <label className="field grow">
              <span className="label">
                Label <span className="required">*</span>
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Connexion VPS"
                autoFocus
              />
            </label>
          </div>

          <div className="field">
            <span className="label">
              Ligne de commande <span className="required">*</span>
            </span>
            <input
              type="text"
              value={commandLine}
              onChange={(e) => setCommandLine(e.target.value)}
              placeholder="Ex: ssh pierre@1.2.3.4, supabase db push, claude"
              className="mono"
            />
            {parsedTokens.length > 0 && (
              <div className="parse-preview">
                <span className="parse-preview-label">Interprété comme :</span>
                <code>{parsedTokens[0]}</code>
                {parsedTokens.slice(1).map((tok, i) => (
                  <code key={i} className="arg-token">
                    {tok}
                  </code>
                ))}
              </div>
            )}
          </div>

          <label className="field">
            <span className="label">Dossier de travail (cwd)</span>
            <div className="cwd-row">
              <input
                type="text"
                value={cwd ?? ""}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="Optionnel — laisse vide pour ~"
                className="mono grow"
              />
              <button
                type="button"
                className="mini-btn"
                onClick={pickCwd}
              >
                Parcourir…
              </button>
            </div>
          </label>

          <div className="field">
            <span className="label">Ouvrir dans</span>
            <div className="radio-group">
              {[
                { value: "tab", label: "Nouvel onglet", glyph: "⇥" },
                { value: "split-h", label: "Split horizontal", glyph: "⇔" },
                { value: "split-v", label: "Split vertical", glyph: "⇕" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`radio-option ${openIn === opt.value ? "checked" : ""}`}
                >
                  <input
                    type="radio"
                    name="openIn"
                    value={opt.value}
                    checked={openIn === opt.value}
                    onChange={() => setOpenIn(opt.value as OpenIn)}
                  />
                  <span className="glyph">{opt.glyph}</span>
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field extra-panes">
            <div className="label-row">
              <span className="label">
                Panels supplémentaires ({extraPanes.length})
              </span>
              <button
                type="button"
                className="mini-btn"
                onClick={addExtraPane}
              >
                + Ajouter un panel
              </button>
            </div>
            {extraPanes.length === 0 && (
              <span className="args-empty">
                Un seul panel. Ajoute des splits ici pour lancer plusieurs
                commandes en un clic.
              </span>
            )}
            {extraPanes.map((pane, i) => {
              const tokens = parseCommandLine(pane.commandLine);
              return (
                <div key={i} className="extra-pane">
                  <div className="extra-pane-head">
                    <span className="extra-pane-num">Panel {i + 2}</span>
                    <div className="dir-toggle">
                      <button
                        type="button"
                        className={`dir-btn ${pane.dir === "h" ? "checked" : ""}`}
                        onClick={() => updateExtraPane(i, { dir: "h" })}
                        title="Split horizontal (nouveau panel à droite)"
                      >
                        → droite
                      </button>
                      <button
                        type="button"
                        className={`dir-btn ${pane.dir === "v" ? "checked" : ""}`}
                        onClick={() => updateExtraPane(i, { dir: "v" })}
                        title="Split vertical (nouveau panel en bas)"
                      >
                        ↓ bas
                      </button>
                    </div>
                    <button
                      type="button"
                      className="mini-btn danger"
                      onClick={() => removeExtraPane(i)}
                      aria-label="Remove pane"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    type="text"
                    value={pane.commandLine}
                    onChange={(e) =>
                      updateExtraPane(i, { commandLine: e.target.value })
                    }
                    placeholder="Ligne de commande (vide = shell)"
                    className="mono"
                  />
                  {tokens.length > 0 && (
                    <div className="parse-preview">
                      <span className="parse-preview-label">→</span>
                      <code>{tokens[0]}</code>
                      {tokens.slice(1).map((t, k) => (
                        <code key={k} className="arg-token">
                          {t}
                        </code>
                      ))}
                    </div>
                  )}
                  <div className="cwd-row">
                    <input
                      type="text"
                      value={pane.cwd}
                      onChange={(e) =>
                        updateExtraPane(i, { cwd: e.target.value })
                      }
                      placeholder="cwd (vide = hérite du bouton)"
                      className="mono grow"
                    />
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => pickExtraCwd(i)}
                    >
                      Parcourir…
                    </button>
                  </div>
                  <div className="timing-row">
                    <label className="timing-field">
                      <span className="label-tiny">Délai (ms)</span>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={pane.delayMs}
                        onChange={(e) =>
                          updateExtraPane(i, { delayMs: e.target.value })
                        }
                        placeholder="0"
                        className="mono"
                      />
                    </label>
                    <label className="timing-field grow">
                      <span className="label-tiny">
                        Attendre le texte (dans panel précédent)
                      </span>
                      <input
                        type="text"
                        value={pane.waitForText}
                        onChange={(e) =>
                          updateExtraPane(i, {
                            waitForText: e.target.value,
                          })
                        }
                        placeholder="Ex: Started supabase local"
                        className="mono"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="field">
            <span className="label">
              Groupe <span className="required">*</span>
            </span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {config.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.icon ? `${g.icon} ` : ""}
                  {g.label}
                </option>
              ))}
              <option value={NEW_GROUP_VALUE}>➕ Nouveau groupe…</option>
            </select>
          </label>

          {groupId === NEW_GROUP_VALUE && (
            <label className="field">
              <span className="label">
                Nom du nouveau groupe <span className="required">*</span>
              </span>
              <input
                type="text"
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                placeholder="Ex: Serveurs, Dev, Perso…"
              />
            </label>
          )}
        </div>

        <div className="btn-editor-footer">
          {isEdit && (
            <button
              className="btn-editor-btn danger"
              onClick={handleDelete}
            >
              Supprimer
            </button>
          )}
          <div className="spacer" />
          <button className="btn-editor-btn secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn-editor-btn primary"
            onClick={handleSubmit}
            disabled={!canSave}
          >
            {isEdit ? "Enregistrer" : "Créer"} (⌘⏎)
          </button>
        </div>
      </div>
    </div>
  );
}
