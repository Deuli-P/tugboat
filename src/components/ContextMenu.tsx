import { useEffect, useRef } from "react";
import "./ContextMenu.css";

export type ContextMenuItem =
  | { kind: "item"; label: string; onClick: () => void; danger?: boolean }
  | { kind: "separator" };

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => {
      window.addEventListener("mousedown", handleClick);
      window.addEventListener("keydown", handleEsc);
    }, 0);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - items.length * 30 - 8),
  };

  return (
    <div ref={menuRef} className="context-menu" style={style}>
      {items.map((item, i) =>
        item.kind === "separator" ? (
          <div key={i} className="context-separator" />
        ) : (
          <button
            key={i}
            className={`context-item ${item.danger ? "danger" : ""}`}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
