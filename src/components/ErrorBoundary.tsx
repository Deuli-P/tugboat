import { Component, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useButtons } from "../state/buttons";
import "./ErrorBoundary.css";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("React error boundary caught:", error, info);
  }

  resetConfig = async () => {
    try {
      const path = await invoke<string>("config_path");
      const defaults = { version: 1, groups: [] };
      await invoke("config_save", { config: defaults });
      console.log("Config reset at", path);
    } catch (e) {
      console.error("Failed to reset config:", e);
    }
    window.location.reload();
  };

  reload = () => {
    useButtons.getState().closeEditor();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-card">
            <h1>Quelque chose a cassé</h1>
            <p className="error-message">{this.state.error.message}</p>
            <details>
              <summary>Stack trace</summary>
              <pre>{this.state.error.stack}</pre>
            </details>
            <div className="error-actions">
              <button className="error-btn secondary" onClick={this.reload}>
                Réessayer
              </button>
              <button className="error-btn danger" onClick={this.resetConfig}>
                Reset config + reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
