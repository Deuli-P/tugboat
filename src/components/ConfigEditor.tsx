import { useEffect, useMemo, useState } from "react";
import { useButtons } from "../state/buttons";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import "./ConfigEditor.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ConfigEditor({ open, onClose }: Props) {
  const config = useButtons((s) => s.config);
  const configPath = useButtons((s) => s.configPath);
  const setConfig = useButtons((s) => s.setConfig);
  const save = useButtons((s) => s.save);

  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (open) {
      setText(JSON.stringify(config, null, 2));
      setDirty(false);
    }
  }, [open, config]);

  const error = useMemo(() => {
    if (!text) return null;
    try {
      JSON.parse(text);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [text]);

  const handleSave = async () => {
    if (error) return;
    try {
      const parsed = JSON.parse(text);
      setConfig(parsed);
      await save();
      setDirty(false);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 1200);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (dirty) {
          if (confirm("Modifications non sauvegardées. Fermer quand même ?")) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, dirty, text, onClose]);

  if (!open) return null;

  const revealInFinder = async () => {
    if (!configPath) return;
    try {
      await revealItemInDir(configPath);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="config-backdrop" onMouseDown={onClose}>
      <div className="config-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="config-header">
          <span className="config-title">buttons.json</span>
          {configPath && (
            <span className="config-path" title={configPath}>
              {configPath}
            </span>
          )}
          <button
            className="config-close"
            onClick={() => (dirty
              ? confirm("Modifications non sauvegardées. Fermer quand même ?") &&
                onClose()
              : onClose())}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <textarea
          className={`config-textarea ${error ? "has-error" : ""}`}
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
        />

        <div className="config-footer">
          <div className="config-status">
            {error ? (
              <span className="config-error" title={error}>
                ⚠ JSON invalide : {error.split("\n")[0]}
              </span>
            ) : savedFeedback ? (
              <span className="config-saved">✓ Sauvegardé</span>
            ) : dirty ? (
              <span className="config-dirty">● Modifications non sauvegardées</span>
            ) : (
              <span className="config-clean">Aucune modification</span>
            )}
          </div>
          <div className="config-actions">
            <button className="config-btn secondary" onClick={revealInFinder}>
              Révéler dans Finder
            </button>
            <button
              className="config-btn primary"
              onClick={handleSave}
              disabled={!!error || !dirty}
            >
              Sauvegarder (⌘S)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
