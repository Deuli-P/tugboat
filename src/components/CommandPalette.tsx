import { useEffect, useMemo, useRef, useState } from "react";
import { useTabs } from "../state/tabs";
import { useButtons, type ButtonCfg, type OpenIn } from "../state/buttons";
import { launchButton } from "../lib/launch";
import "./CommandPalette.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Item =
  | { kind: "shell"; openIn: OpenIn; label: string }
  | { kind: "button"; button: ButtonCfg; groupLabel: string; groupIcon: string };

function launchShell(openIn: OpenIn) {
  const state = useTabs.getState();
  const spawn = { command: "", args: [], cwd: null };
  if (openIn === "tab") {
    state.addTab({ title: "shell", spawn });
    return;
  }
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (!tab) {
    state.addTab({ title: "shell", spawn });
    return;
  }
  const dir = openIn === "split-h" ? "h" : "v";
  state.splitPane(tab.id, tab.activeLeafId, dir, spawn);
}

function openInGlyph(openIn: OpenIn): string {
  return openIn === "tab" ? "⇥" : openIn === "split-h" ? "⇔" : "⇕";
}

function openInLabel(openIn: OpenIn): string {
  return openIn === "tab"
    ? "Nouvel onglet"
    : openIn === "split-h"
      ? "Split horizontal"
      : "Split vertical";
}

export function CommandPalette({ open, onClose }: Props) {
  const config = useButtons((s) => s.config);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const g of config.groups) {
      for (const b of g.buttons) {
        list.push({
          kind: "button",
          button: b,
          groupLabel: g.label,
          groupIcon: g.icon ?? "",
        });
      }
    }
    (["tab", "split-h", "split-v"] as const).forEach((oi) =>
      list.push({
        kind: "shell",
        openIn: oi,
        label: `Nouveau shell — ${openInLabel(oi)}`,
      }),
    );
    return list;
  }, [config]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      if (it.kind === "shell") {
        return (
          "shell".includes(q) ||
          "nouveau".includes(q) ||
          openInLabel(it.openIn).toLowerCase().includes(q)
        );
      }
      const b = it.button;
      return (
        b.label.toLowerCase().includes(q) ||
        b.command.toLowerCase().includes(q) ||
        b.args.some((a) => a.toLowerCase().includes(q)) ||
        it.groupLabel.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    if (selected >= filtered.length && filtered.length > 0) {
      setSelected(filtered.length - 1);
    }
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, filtered.length]);

  const launch = (item: Item) => {
    if (item.kind === "shell") {
      launchShell(item.openIn);
    } else {
      launchButton(item.button);
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(filtered.length - 1, s + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selected];
        if (item) launch(item);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  });

  if (!open) return null;

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <span className="palette-icon">⌘K</span>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            placeholder="Rechercher un bouton, ou taper 'shell'…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="palette-empty">Aucun résultat</div>
          )}
          {filtered.map((item, i) => {
            const active = i === selected;
            if (item.kind === "shell") {
              return (
                <div
                  key={`shell-${item.openIn}`}
                  data-index={i}
                  className={`palette-item ${active ? "active" : ""}`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => launch(item)}
                >
                  <span className="pi-icon">🐚</span>
                  <div className="pi-main">
                    <span className="pi-label">Nouveau shell</span>
                    <span className="pi-sub">
                      $SHELL — {openInLabel(item.openIn)}
                    </span>
                  </div>
                  <span className="pi-arrow">{openInGlyph(item.openIn)}</span>
                </div>
              );
            }
            const b = item.button;
            const preview = [b.command, ...b.args].join(" ");
            return (
              <div
                key={b.id}
                data-index={i}
                className={`palette-item ${active ? "active" : ""}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => launch(item)}
              >
                <span className="pi-icon">{b.icon || "▸"}</span>
                <div className="pi-main">
                  <span className="pi-label">{b.label}</span>
                  <span className="pi-sub">
                    {item.groupIcon} {item.groupLabel} · {preview}
                  </span>
                </div>
                <span className="pi-arrow">{openInGlyph(b.openIn)}</span>
              </div>
            );
          })}
        </div>
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> naviguer
          </span>
          <span>
            <kbd>⏎</kbd> lancer
          </span>
          <span>
            <kbd>Esc</kbd> fermer
          </span>
        </div>
      </div>
    </div>
  );
}
