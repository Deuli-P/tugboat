import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl, openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

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

  useEffect(() => {
    if (waiting) return;
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      fontFamily:
        'Menlo, "SF Mono", Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
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
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(
      new WebLinksAddon((_evt, uri) => {
        void handleLinkClick(uri);
      }),
    );
    term.open(container);
    fitAddon.fit();

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

    const ro = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    ro.observe(container);

    const handleClick = () => onFocusRef.current?.();
    container.addEventListener("mousedown", handleClick);

    return () => {
      container.removeEventListener("mousedown", handleClick);
      ro.disconnect();
      dataSub.dispose();
      resizeSub.dispose();
      unlistenDataPromise.then((fn) => fn());
      unlistenClosePromise.then((fn) => fn());
      if (spawned) {
        invoke("pty_kill", { id: ptyId }).catch(() => {});
      }
      term.dispose();
    };
  }, [ptyId, waiting]);

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
