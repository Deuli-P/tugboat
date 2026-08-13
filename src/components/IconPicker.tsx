import { useEffect, useMemo, useState } from "react";
import "./IconPicker.css";

type Props = {
  current?: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
};

const CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "Dev",
    emojis: [
      "🚀", "⚡", "🔧", "🛠", "⚙", "🧰", "🐛", "🐞", "🧪", "🔬",
      "💻", "🖥", "🖱", "⌨", "💾", "💽", "💿", "📀", "🔌", "🔋",
      "📡", "🛰", "🧠", "🤖", "👾", "🔒", "🔓", "🔑", "🗝", "🧩",
    ],
  },
  {
    name: "Serveurs",
    emojis: [
      "☁", "⛅", "🌐", "🌍", "🌎", "🌏", "📶", "📈", "📉", "📊",
      "🏭", "🏢", "🏛", "🚦", "🛡", "🧯", "🔗", "🧬", "📦", "🗄",
    ],
  },
  {
    name: "Docs",
    emojis: [
      "📁", "📂", "🗂", "📄", "📃", "📜", "📝", "🗒", "📋", "📌",
      "📎", "🖇", "🗃", "🗓", "🗒", "📔", "📕", "📗", "📘", "📙",
    ],
  },
  {
    name: "Actions",
    emojis: [
      "▶", "⏸", "⏹", "⏺", "⏭", "⏮", "⏩", "⏪", "🔁", "🔂",
      "🔄", "🔃", "✅", "❌", "❗", "❓", "⚠", "🔥", "✨", "💡",
    ],
  },
  {
    name: "Objets",
    emojis: [
      "🎯", "🎨", "🎬", "🎵", "🎧", "🎤", "📷", "📸", "🎥", "🎮",
      "🕹", "🎲", "🃏", "🎪", "🎁", "🎈", "🎉", "🎊", "🏆", "🏅",
    ],
  },
  {
    name: "Nature",
    emojis: [
      "🌱", "🌿", "🌳", "🌲", "🍀", "🌸", "🌺", "🌻", "🌷", "🌹",
      "🐳", "🐬", "🦈", "🐙", "🦀", "🐢", "🦎", "🦋", "🐝", "🦉",
    ],
  },
];

export function IconPicker({ current, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(CATEGORIES[0].name);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const shownEmojis = useMemo(() => {
    if (query.trim()) {
      const q = query.trim();
      const all = CATEGORIES.flatMap((c) => c.emojis);
      return all.filter((e) => e.includes(q));
    }
    return CATEGORIES.find((c) => c.name === tab)?.emojis ?? [];
  }, [query, tab]);

  return (
    <div className="icon-picker-backdrop" onMouseDown={onClose}>
      <div
        className="icon-picker"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="icon-picker-header">
          <span className="icon-picker-title">Choisir une icône</span>
          <button
            className="icon-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="icon-picker-search">
          <input
            type="text"
            placeholder="Coller un emoji ou taper..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {current && (
            <button
              type="button"
              className="icon-picker-clear"
              onClick={() => onPick("")}
              title="Retirer l'icône"
            >
              Retirer
            </button>
          )}
        </div>

        {!query.trim() && (
          <div className="icon-picker-tabs">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                className={`icon-picker-tab ${c.name === tab ? "active" : ""}`}
                onClick={() => setTab(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="icon-picker-grid">
          {shownEmojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              className={`icon-picker-cell ${current === emoji ? "selected" : ""}`}
              onClick={() => onPick(emoji)}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
          {shownEmojis.length === 0 && (
            <div className="icon-picker-empty">Aucun résultat</div>
          )}
        </div>

        <div className="icon-picker-hint">
          Astuce : copie-colle n'importe quel emoji dans le champ ci-dessus (⌃⌘Space sur macOS).
        </div>
      </div>
    </div>
  );
}
