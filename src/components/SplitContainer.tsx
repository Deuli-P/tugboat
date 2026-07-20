import { useCallback, useRef } from "react";
import { Terminal } from "./Terminal";
import { useTabs, type PaneNode, type Tab } from "../state/tabs";
import "./SplitContainer.css";

type Props = {
  tab: Tab;
  node: PaneNode;
};

export function SplitContainer({ tab, node }: Props) {
  const setActiveLeaf = useTabs((s) => s.setActiveLeaf);
  const setRatio = useTabs((s) => s.setRatio);

  if (node.kind === "leaf") {
    const isActive = tab.activeLeafId === node.id;
    return (
      <div
        className={`pane-leaf ${isActive ? "active" : ""}`}
        onMouseDownCapture={() => setActiveLeaf(tab.id, node.id)}
      >
        <Terminal
          ptyId={node.ptyId}
          command={node.command}
          args={node.args}
          cwd={node.cwd}
          waiting={node.waiting ?? null}
          onFocus={() => setActiveLeaf(tab.id, node.id)}
        />
      </div>
    );
  }

  return (
    <SplitPane
      tab={tab}
      node={node}
      onRatio={(ratio) => setRatio(tab.id, node.id, ratio)}
    />
  );
}

function SplitPane({
  tab,
  node,
  onRatio,
}: {
  tab: Tab;
  node: Extract<PaneNode, { kind: "split" }>;
  onRatio: (ratio: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = node.dir === "h" ? "col-resize" : "row-resize";
  }, [node.dir]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio =
        node.dir === "h"
          ? (e.clientX - rect.left) / rect.width
          : (e.clientY - rect.top) / rect.height;
      const clamped = Math.max(0.1, Math.min(0.9, ratio));
      onRatio(clamped);
    },
    [node.dir, onRatio],
  );

  const onMouseUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = "";
  }, []);

  return (
    <div
      ref={containerRef}
      className={`split split-${node.dir}`}
      onMouseMove={(e) => onMouseMove(e.nativeEvent)}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        className="split-child"
        style={
          node.dir === "h"
            ? { width: `${node.ratio * 100}%` }
            : { height: `${node.ratio * 100}%` }
        }
      >
        <SplitContainer tab={tab} node={node.a} />
      </div>
      <div
        className={`separator separator-${node.dir}`}
        onMouseDown={onMouseDown}
      />
      <div
        className="split-child"
        style={
          node.dir === "h"
            ? { width: `${(1 - node.ratio) * 100}%` }
            : { height: `${(1 - node.ratio) * 100}%` }
        }
      >
        <SplitContainer tab={tab} node={node.b} />
      </div>
    </div>
  );
}
