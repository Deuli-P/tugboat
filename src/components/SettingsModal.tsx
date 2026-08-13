import { useEffect, useState } from "react";
import { useUI, type ThemeMode } from "../state/ui";
import {
  readCustomColors,
  writeCustomColors,
  clearCustomColors,
  reapplyWithCustomColors,
  type CustomColors,
} from "../lib/theme";
import "./SettingsModal.css";

const MODES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "light", label: "Clair", hint: "Interface lumineuse" },
  { value: "dark", label: "Sombre", hint: "Interface sombre" },
  { value: "system", label: "Système", hint: "Suit macOS / OS" },
];

export function SettingsModal() {
  const open = useUI((s) => s.settingsOpen);
  const close = useUI((s) => s.closeSettings);
  const themeMode = useUI((s) => s.themeMode);
  const setThemeMode = useUI((s) => s.setThemeMode);

  const [colors, setColors] = useState<CustomColors>(() => readCustomColors());

  useEffect(() => {
    if (open) setColors(readCustomColors());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, close]);

  if (!open) return null;

  const patch = (partial: Partial<CustomColors>) => {
    const next = { ...colors, ...partial };
    setColors(next);
    writeCustomColors(next);
    reapplyWithCustomColors(themeMode);
  };

  const reset = () => {
    clearCustomColors();
    setColors({});
    reapplyWithCustomColors(themeMode);
  };

  return (
    <div className="settings-backdrop" onMouseDown={close}>
      <div
        className="settings-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <span className="settings-title">Préférences</span>
          <button
            className="settings-close"
            onClick={close}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <h4 className="settings-section-title">Thème</h4>
            <div className="theme-mode-grid">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  className={`theme-mode-btn ${themeMode === m.value ? "active" : ""}`}
                  onClick={() => setThemeMode(m.value)}
                >
                  <span className="theme-mode-label">{m.label}</span>
                  <span className="theme-mode-hint">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-head">
              <h4 className="settings-section-title">Couleurs personnalisées</h4>
              <button className="settings-reset" onClick={reset}>
                Réinitialiser
              </button>
            </div>
            <div className="color-row">
              <label className="color-field">
                <span>Fond</span>
                <input
                  type="color"
                  value={colors.background ?? "#1a1b26"}
                  onChange={(e) => patch({ background: e.target.value })}
                />
                <input
                  type="text"
                  className="color-hex"
                  value={colors.background ?? ""}
                  placeholder="auto"
                  onChange={(e) =>
                    patch({ background: e.target.value || undefined })
                  }
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
              <label className="color-field">
                <span>Texte</span>
                <input
                  type="color"
                  value={colors.text ?? "#c0caf5"}
                  onChange={(e) => patch({ text: e.target.value })}
                />
                <input
                  type="text"
                  className="color-hex"
                  value={colors.text ?? ""}
                  placeholder="auto"
                  onChange={(e) =>
                    patch({ text: e.target.value || undefined })
                  }
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
              <label className="color-field">
                <span>Boutons</span>
                <input
                  type="color"
                  value={colors.button ?? "#7aa2f7"}
                  onChange={(e) => patch({ button: e.target.value })}
                />
                <input
                  type="text"
                  className="color-hex"
                  value={colors.button ?? ""}
                  placeholder="auto"
                  onChange={(e) =>
                    patch({ button: e.target.value || undefined })
                  }
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
            </div>
            <p className="settings-hint">
              Les couleurs personnalisées s'appliquent par-dessus le thème
              choisi. Laisse vide pour les valeurs par défaut.
            </p>
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-btn primary" onClick={close}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
