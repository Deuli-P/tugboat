import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon, type ISearchResultChangeEvent } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl, openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  readText as readClipboardText,
  writeText as writeClipboardText,
} from "@tauri-apps/plugin-clipboard-manager";
import { useTabs } from "../state/tabs";
import { useUI } from "../state/ui";
import { usePtyStatus } from "../state/ptyStatus";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

// Désactive localement (côté xterm.js uniquement, rien n'est envoyé au shell)
// les modes DEC laissés allumés par un programme qui a planté/été tué sans
// nettoyer (mouse tracking, bracketed paste) — sinon plus aucune sélection
// souris locale n'est possible tant que xterm.js croit qu'une appli lit les
// événements souris.
const RESET_MODES_SEQUENCE =
  "\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1015l\x1b[?2004l";

const SEARCH_DECORATIONS = {
  matchBackground: "rgba(224, 175, 104, 0.35)",
  matchBorder: "#e0af68",
  matchOverviewRuler: "#e0af68",
  activeMatchBackground: "rgba(122, 162, 247, 0.45)",
  activeMatchBorder: "#7aa2f7",
  activeMatchColorOverviewRuler: "#7aa2f7",
};

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
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const frozenScrollRef = useRef<number | null>(null);
  const activeTabId = useTabs((s) => s.activeTabId);
  const themeMode = useUI((s) => s.themeMode);

  const [searchOpen, setSearchOpen] = useState(false);
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchOpen;
  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryRef = useRef("");
  searchQueryRef.current = searchQuery;
  const [searchResult, setSearchResult] = useState<ISearchResultChangeEvent | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const resetTerminalModes = () => {
    termRef.current?.write(RESET_MODES_SEQUENCE);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResult(null);
    searchAddonRef.current?.clearDecorations();
    termRef.current?.focus();
  };

  const runSearch = (direction: "next" | "prev") => {
    const addon = searchAddonRef.current;
    const term = searchQueryRef.current;
    if (!addon || !term) return;
    if (direction === "next") {
      addon.findNext(term, { decorations: SEARCH_DECORATIONS, incremental: false });
    } else {
      addon.findPrevious(term, { decorations: SEARCH_DECORATIONS });
    }
  };

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
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      theme: buildXtermTheme(initialResolved),
    });

    term.attachCustomKeyEventHandler((event) => {
      // Shift+Enter → newline dans le prompt (ne pas soumettre)
      if (
        event.key === "Enter" &&
        event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        if (event.type === "keydown") {
          invoke("pty_write", { id: ptyId, data: "\x1b\r" }).catch(() => {});
        }
        return false;
      }

      // Cmd+C → copie la sélection (jamais SIGINT)
      if (event.metaKey && event.key === "c" && !event.ctrlKey) {
        if (event.type === "keydown") {
          const selection = term.getSelection();
          if (selection) {
            writeClipboardText(selection).catch(() => {});
          }
        }
        return false;
      }

      // Cmd+V → paste dans le PTY (clipboard natif, pas de popup WebView)
      if (event.metaKey && event.key === "v" && !event.ctrlKey) {
        if (event.type === "keydown") {
          readClipboardText()
            .then((text) => {
              if (text) {
                invoke("pty_write", { id: ptyId, data: text }).catch(() => {});
              }
            })
            .catch(() => {});
        }
        return false;
      }

      // Cmd+A → select all dans le terminal
      if (event.metaKey && event.key === "a" && !event.ctrlKey) {
        if (event.type === "keydown") {
          term.selectAll();
        }
        return false;
      }

      // Cmd+F → ouvre la barre de recherche
      if (event.metaKey && event.key === "f" && !event.ctrlKey) {
        if (event.type === "keydown") {
          setSearchOpen(true);
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }
        return false;
      }

      // Escape → ferme la recherche si elle est ouverte (sinon laisse passer au shell)
      if (event.key === "Escape" && searchOpenRef.current) {
        if (event.type === "keydown") {
          closeSearch();
        }
        return false;
      }

      return true;
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(
      new WebLinksAddon((_evt, uri) => {
        void handleLinkClick(uri);
      }),
    );
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    const searchResultSub = searchAddon.onDidChangeResults((res) => {
      setSearchResult(res);
    });
    searchAddonRef.current = searchAddon;
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = "11";

    // Fige le scroll pendant une sélection en cours pour que l'arrivée de
    // nouvelles données (ex: logs de `supabase start`) ne fasse pas défiler
    // le texte sous la souris en plein glisser-sélectionner.
    const selectionSub = term.onSelectionChange(() => {
      if (term.hasSelection()) {
        if (frozenScrollRef.current === null) {
          frozenScrollRef.current = term.buffer.active.viewportY;
        }
      } else if (frozenScrollRef.current !== null) {
        frozenScrollRef.current = null;
        term.scrollToBottom();
      }
    });

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
        usePtyStatus.getState().setRunning(ptyId);
      })
      .catch((err) => {
        term.write(`\r\n\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`);
      });

    const unlistenDataPromise = listen<string>(
      `pty:data:${ptyId}`,
      (evt) => {
        term.write(evt.payload, () => {
          if (frozenScrollRef.current !== null) {
            term.scrollToLine(frozenScrollRef.current);
          }
        });
      },
    );

    const unlistenClosePromise = listen(`pty:close:${ptyId}`, () => {
      term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
      usePtyStatus.getState().setExited(ptyId);
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
      searchResultSub.dispose();
      selectionSub.dispose();
      frozenScrollRef.current = null;
      unlistenDataPromise.then((fn) => fn());
      unlistenClosePromise.then((fn) => fn());
      if (spawned) {
        invoke("pty_kill", { id: ptyId }).catch(() => {});
      }
      usePtyStatus.getState().clear(ptyId);
      fitRef.current = null;
      termRef.current = null;
      searchAddonRef.current = null;
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

  useEffect(() => {
    const addon = searchAddonRef.current;
    if (!addon) return;
    if (!searchQuery) {
      addon.clearDecorations();
      setSearchResult(null);
      return;
    }
    addon.findNext(searchQuery, {
      decorations: SEARCH_DECORATIONS,
      incremental: true,
    });
  }, [searchQuery]);

  return (
    <div
      className="terminal-wrap"
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div ref={containerRef} className="terminal-container" />
      {waiting && (
        <div className="terminal-waiting" onMouseDown={() => onFocusRef.current?.()}>
          <div className="waiting-badge">
            <span className="waiting-spinner">◐</span>
            <span className="waiting-text">{waiting}</span>
          </div>
        </div>
      )}
      {searchOpen && (
        <div className="terminal-search-bar">
          <input
            ref={searchInputRef}
            className="terminal-search-input"
            type="text"
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(e.shiftKey ? "prev" : "next");
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeSearch();
              }
            }}
          />
          <span className="terminal-search-count">
            {searchQuery
              ? searchResult && searchResult.resultCount > 0
                ? `${searchResult.resultIndex + 1}/${searchResult.resultCount}`
                : "0/0"
              : ""}
          </span>
          <button
            type="button"
            className="terminal-search-btn"
            title="Précédent (Shift+Entrée)"
            onClick={() => runSearch("prev")}
          >
            ↑
          </button>
          <button
            type="button"
            className="terminal-search-btn"
            title="Suivant (Entrée)"
            onClick={() => runSearch("next")}
          >
            ↓
          </button>
          <button
            type="button"
            className="terminal-search-btn"
            title="Fermer (Échap)"
            onClick={closeSearch}
          >
            ✕
          </button>
        </div>
      )}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={[
            {
              kind: "item",
              label: "Réinitialiser le terminal",
              onClick: resetTerminalModes,
            } satisfies ContextMenuItem,
          ]}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
