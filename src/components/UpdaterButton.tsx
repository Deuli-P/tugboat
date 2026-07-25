import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import "./UpdaterButton.css";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "uptodate" }
  | {
      kind: "available";
      update: Update;
    }
  | { kind: "downloading"; percent: number | null }
  | { kind: "installing" }
  | { kind: "error"; message: string };

export function UpdaterButton() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [version, setVersion] = useState<string>("…");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("?"));
  }, []);

  const doCheck = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      const upd = await check();
      if (upd) {
        setState({ kind: "available", update: upd });
      } else {
        setState({ kind: "uptodate" });
        setTimeout(() => setState({ kind: "idle" }), 2500);
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      setTimeout(() => setState({ kind: "idle" }), 4000);
    }
  }, []);

  const doInstall = useCallback(async () => {
    if (state.kind !== "available") return;
    setState({ kind: "downloading", percent: null });
    try {
      let contentLength = 0;
      let downloaded = 0;
      await state.update.downloadAndInstall((evt) => {
        if (evt.event === "Started") {
          contentLength = evt.data.contentLength ?? 0;
          setState({ kind: "downloading", percent: 0 });
        } else if (evt.event === "Progress") {
          downloaded += evt.data.chunkLength;
          const pct = contentLength
            ? Math.min(100, Math.round((downloaded / contentLength) * 100))
            : null;
          setState({ kind: "downloading", percent: pct });
        } else if (evt.event === "Finished") {
          setState({ kind: "installing" });
        }
      });
      await relaunch();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [state]);

  const renderContent = () => {
    switch (state.kind) {
      case "idle":
        return (
          <button className="up-btn" onClick={doCheck}>
            Vérifier les mises à jour
          </button>
        );
      case "checking":
        return (
          <div className="up-status">
            <span className="up-spinner">◐</span>
            <span>Vérification…</span>
          </div>
        );
      case "uptodate":
        return (
          <div className="up-status success">
            <span>✓ À jour</span>
          </div>
        );
      case "available":
        return (
          <button className="up-btn primary" onClick={doInstall}>
            Installer v{state.update.version}
          </button>
        );
      case "downloading":
        return (
          <div className="up-progress">
            <div className="up-progress-label">
              Téléchargement{state.percent !== null && ` ${state.percent}%`}
            </div>
            <div className="up-progress-bar">
              <div
                className="up-progress-fill"
                style={{ width: `${state.percent ?? 30}%` }}
              />
            </div>
          </div>
        );
      case "installing":
        return (
          <div className="up-status">
            <span className="up-spinner">◐</span>
            <span>Installation puis redémarrage…</span>
          </div>
        );
      case "error":
        return (
          <div className="up-status error" title={state.message}>
            <span>⚠ Erreur : {state.message.slice(0, 40)}</span>
          </div>
        );
    }
  };

  return (
    <div className="updater-widget">
      <div className="up-version">Tugboat v{version}</div>
      {renderContent()}
    </div>
  );
}
