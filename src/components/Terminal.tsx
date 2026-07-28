import { useEffect, useRef } from "react";
import { Terminal as XTerm, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl, openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTabs } from "../state/tabs";
import { useUI } from "../state/ui";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

function resolveThemeMode(mode: "light" | "dark" | "system"): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return mode;
}

function readCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function buildXtermTheme(resolved: "light" | "dark"): ITheme {
  if (resolved === "light") {
    return {
      background: readCssVar("--terminal-bg", "#ffffff"),
      foreground: readCssVar("--text", "#1a1b26"),
      cursor: readCssVar("--text", "#1a1b26"),
      black: "#0f0f14",
      red: "#c14a4a",
      green: "#4c8a3f",
      yellow: "#a67e00",
      blue: "#3b7dd8",
      magenta: "#8a5cf6",
      cyan: "#137a89",
      white: "#3d3d3d",
      brightBlack: "#5a5a5a",
      brightRed: "#c14a4a",
      brightGreen: "#4c8a3f",
      brightYellow: "#a67e00",
      brightBlue: "#3b7dd8",
      brightMagenta: "#8a5cf6",
      brightCyan: "#137a89",
      brightWhite: "#1a1b26",
    };
  }
  return {
    background: readCssVar("--terminal-bg", "#1a1b26"),
    foreground: readCssVar("--text", "#c0caf5"),
    cursor: readCssVar("--text", "#c0caf5"),
    black: "#15161e",
    red: "#f7768e",
    green: "#9ece6a",
    yellow: "#e0af68",
    blue: "#7aa2f7",
    magenta: "#bb9af7",
    cyan: "#7dcfff",
    white: "#a9b1d6",
    brightBlack: "#414868",
    brightRed: "#f7768e",
    brightGreen: "#9ece6a",
    brightYellow: "#e0af68",
    brightBlue: "#7aa2f7",
    brightMagenta: "#bb9af7",
    brightCyan: "#7dcfff",
    brightWhite: "#c0caf5",
  };
}

async function handleLinkClick(uri: string) {
  try {
    if (/^(https?|ftp|ws|wss):\/\//i.test(uri)) {
      await openUrl(uri);
      return;
    }
    if (uri.startsWith("file://")) {
      const path = decodeURIComponent(uri.replace(/^file:\/\//, ""));
      try {
        await openPath(path);
      } catch {
        await revealItemInDir(path);
      }
      return;
    }
    if (uri.startsWith("/") || uri.startsWith("~")) {
      const path = uri.startsWith("~")
        ? uri.replace(/^~/, "")
        : uri;
      try {
        await openPath(path);
      } catch {
        await revealItemInDir(path);
      }
      return;
    }
    await openUrl(uri);
  } catch (err) {
    console.error("Failed to open link:", uri, err);
  }
}

type Props = {
  ptyId: string;
  command?: string;
  args?: string[];
  cwd?: string | null;
  waiting?: string | null;
  onFocus?: () => void;
};

const EMPTY_ARGS: string[] = [];

export function Terminal({
  ptyId,
  command = "",
  args = EMPTY_ARGS,
  cwd = null,
  waiting = null,
  onFocus,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const spawnArgsRef = useRef({ command, args, cwd });
  spawnArgsRef.current = { command, args, cwd };
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const activeTabId = useTabs((s) => s.activeTabId);
  const themeMode = useUI((s) => s.themeMode);

  useEffect(() => {
    if (waiting) return;
    const container = containerRef.current;
    if (!container) return;

    const initialResolved = resolveThemeMode(themeMode);
    const term = new XTerm({
      fontFamily:
        'Menlo, "SF Mono", Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
      theme: buildXtermTheme(initialResolved),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(
      new WebLinksAddon((_evt, uri) => {
        void handleLinkClick(uri);
      }),
    );
    term.open(container);
    fitRef.current = fitAddon;
    termRef.current = term;
    try {
      fitAddon.fit();
    } catch {
      // ignore
    }

    const { cols, rows } = term;
    const { command: cmd, args: cmdArgs, cwd: cmdCwd } = spawnArgsRef.current;

    let spawned = false;
    invoke("pty_spawn", {
      id: ptyId,
      command: cmd,
      args: cmdArgs,
      cwd: cmdCwd,
      cols,
      rows,
    })
      .then(() => {
        spawned = true;
      })
      .catch((err) => {
        term.write(`\r\n\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`);
      });

    const unlistenDataPromise = listen<string>(
      `pty:data:${ptyId}`,
      (evt) => {
        term.write(evt.payload);
      },
    );

    const unlistenClosePromise = listen(`pty:close:${ptyId}`, () => {
      term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
    });

    const dataSub = term.onData((data) => {
      invoke("pty_write", { id: ptyId, data }).catch(() => {});
    });

    const resizeSub = term.onResize(({ cols, rows }) => {
      invoke("pty_resize", { id: ptyId, cols, rows }).catch(() => {});
    });

    let fitRaf = 0;
    const scheduleFit = () => {
      if (fitRaf) cancelAnimationFrame(fitRaf);
      fitRaf = requestAnimationFrame(() => {
        fitRaf = 0;
        try {
          fitAddon.fit();
        } catch {
          // ignore
        }
      });
    };

    const ro = new ResizeObserver(() => scheduleFit());
    ro.observe(container);

    const onWinResize = () => scheduleFit();
    window.addEventListener("resize", onWinResize);

    const handleClick = () => onFocusRef.current?.();
    container.addEventListener("mousedown", handleClick);

    return () => {
      container.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", onWinResize);
      if (fitRaf) cancelAnimationFrame(fitRaf);
      ro.disconnect();
      dataSub.dispose();
      resizeSub.dispose();
      unlistenDataPromise.then((fn) => fn());
      unlistenClosePromise.then((fn) => fn());
      if (spawned) {
        invoke("pty_kill", { id: ptyId }).catch(() => {});
      }
      fitRef.current = null;
      termRef.current = null;
      term.dispose();
    };
  }, [ptyId, waiting]);

  useEffect(() => {
    if (!termRef.current || !fitRef.current) return;
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
        } catch {
          // ignore
        }
      });
      (raf1 as any).next = raf2;
    });
    return () => {
      cancelAnimationFrame(raf1);
      if ((raf1 as any).next) cancelAnimationFrame((raf1 as any).next);
    };
  }, [activeTabId]);

  useEffect(() => {
    if (!termRef.current) return;
    const apply = () => {
      if (!termRef.current) return;
      const resolved = resolveThemeMode(themeMode);
      termRef.current.options.theme = buildXtermTheme(resolved);
    };
    apply();
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themeMode]);

  return (
    <div className="terminal-wrap">
      <div ref={containerRef} className="terminal-container" />
      {waiting && (
        <div className="terminal-waiting" onMouseDown={() => onFocusRef.current?.()}>
          <div className="waiting-badge">
            <span className="waiting-spinner">◐</span>
            <span className="waiting-text">{waiting}</span>
          </div>
        </div>
      )}
    </div>
  );
}
