"use client";

/**
 * Custom always-visible block-actions toolbar for the Puck portfolio editor.
 *
 * Anchors to the selected block's bounding rect via a rAF loop and portals
 * to document.body, so it is always visible (unlike Puck's built-in floating
 * action bar whose visibility is gated by internal dragFinished state).
 *
 * Uses createUsePuck with narrow selectors to avoid the bare-usePuck
 * perf warning and to minimise unnecessary re-renders.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createUsePuck } from "@measured/puck";
import { ArrowUp, ArrowDown, ArrowUpFromLine, Copy, Trash2 } from "lucide-react";
import { selectedBlockActions } from "@/lib/page-builder/moveBlockToRoot";
import type { BlockActions } from "@/lib/page-builder/moveBlockToRoot";

// Module-level selector hook — stable reference, no closure over changing values.
const usePuckSel = createUsePuck();

// ---------------------------------------------------------------------------
// useBlockRect — rAF loop that tracks the bounding rect of [data-puck-component]
// ---------------------------------------------------------------------------

type Rect = { top: number; right: number; width: number; height: number };

function useBlockRect(id: string | undefined): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (typeof document === "undefined" || !id) {
      const raf = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(raf);
    }

    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-puck-component="${id}"]`);
      if (!el || !el.isConnected) {
        setRect(null);
        rafRef.current = requestAnimationFrame(measure);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        rafRef.current = requestAnimationFrame(measure);
        return;
      }
      setRect({ top: r.top, right: r.right, width: r.width, height: r.height });
      rafRef.current = requestAnimationFrame(measure);
    }

    rafRef.current = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  return rect;
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

type ToolbarButtonProps = {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  hidden?: boolean;
  children: React.ReactNode;
};

function ToolbarButton({ label, onClick, disabled, hidden, children }: ToolbarButtonProps) {
  if (hidden) return null;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// BlockActionsToolbar — main export
// ---------------------------------------------------------------------------

export function BlockActionsToolbar() {
  const selectedItem = usePuckSel((s) => s.selectedItem);
  const itemSelector = usePuckSel((s) => s.appState?.ui?.itemSelector ?? null);
  const rootLen = usePuckSel((s) => s.appState?.data?.content?.length ?? 0);
  const dispatch = usePuckSel((s) => s.dispatch);

  const blockId: string | undefined =
    selectedItem && "props" in selectedItem ? (selectedItem as { props?: { id?: string } }).props?.id : undefined;

  const rect = useBlockRect(blockId);

  if (!selectedItem || !itemSelector) return null;

  const actions: BlockActions | null = selectedBlockActions(itemSelector, rootLen);
  if (!actions) return null;

  // Position: top-right of the block, just above its top edge.
  // If it would clip off the top of the viewport, place just inside.
  const TOOLBAR_H = 32; // approximate height of toolbar in px
  const GAP = 4;
  let top = rect ? rect.top - TOOLBAR_H - GAP : 0;
  if (top < 0) top = GAP;
  const left = rect ? rect.right : 0;

  const label = (selectedItem as { type?: string }).type ?? "Block";

  const toolbar = (
    <div
      role="toolbar"
      aria-label={`${label} actions`}
      style={{
        position: "fixed",
        top,
        left,
        transform: "translateX(-100%)",
        zIndex: 9999,
      }}
      className="flex items-center gap-0.5 rounded-[--radius] border border-border bg-card px-1 shadow-none"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="select-none px-1 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label="Move up"
        disabled={!actions.moveUp}
        onClick={() => actions.moveUp && dispatch(actions.moveUp)}
      >
        <ArrowUp size={14} aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Move down"
        onClick={() => dispatch(actions.moveDown)}
      >
        <ArrowDown size={14} aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Move out"
        hidden={!actions.moveOut}
        onClick={() => actions.moveOut && dispatch(actions.moveOut)}
      >
        <ArrowUpFromLine size={14} aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Duplicate"
        onClick={() => dispatch(actions.duplicate)}
      >
        <Copy size={14} aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Delete"
        onClick={() => dispatch(actions.remove)}
      >
        <Trash2 size={14} aria-hidden />
      </ToolbarButton>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(toolbar, document.body);
}
