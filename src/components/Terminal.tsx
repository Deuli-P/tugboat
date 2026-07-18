import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { nanoid } from "nanoid";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

type Props = {
  command?: string;
  args?: string[];
  cwd?: string | null;
};

export function Terminal({ command = "", args = [], cwd = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const id = nanoid();

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
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    fitAddon.fit();

    const { cols, rows } = term;

    let spawned = false;
    invoke("pty_spawn", { id, command, args, cwd, cols, rows })
      .then(() => {
        spawned = true;
      })
      .catch((err) => {
        term.write(`\r\n\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`);
      });

    const unlistenDataPromise = listen<string>(`pty:data:${id}`, (evt) => {
      term.write(evt.payload);
    });

    const unlistenClosePromise = listen(`pty:close:${id}`, () => {
      term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
    });

    const dataSub = term.onData((data) => {
      invoke("pty_write", { id, data }).catch(() => {});
    });

    const resizeSub = term.onResize(({ cols, rows }) => {
      invoke("pty_resize", { id, cols, rows }).catch(() => {});
    });

    const ro = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      dataSub.dispose();
      resizeSub.dispose();
      unlistenDataPromise.then((fn) => fn());
      unlistenClosePromise.then((fn) => fn());
      if (spawned) {
        invoke("pty_kill", { id }).catch(() => {});
      }
      term.dispose();
    };
  }, [command, args, cwd]);

  return <div ref={containerRef} className="terminal-container" />;
}
