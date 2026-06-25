"use client";

/**
 * Custom always-visible block-actions toolbar for the Puck portfolio editor.
 *
 * Anchors to the selected block's bounding rect via a rAF loop and portals
 * to document.body, so it is always visible (unlike Puck's built-in floating
 * action bar whose visibility is gated by internal dragFinished state).
 *
 * Positioning rules:
 *  - Sits above the block, right-aligned, by default.
 *  - Inverts to just-inside the block's top edge (mirroring Puck's own overlay
 *    flip) when there isn't room above within the canvas viewport — e.g. the
 *    first block at the very top of the canvas.
 *  - Clipped to the canvas band: hidden once the block scrolls out of view, so
 *    it never floats over the editor header / section tabs (or below the canvas).
 *  - Hidden while a header panel is open (Photos / Theme / Guide / Drafts /
 *    publish confirm) — detected via any open dialog/menu in the document.
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

// Any of these being present in the document means an editor panel/menu is open
// (Theme/Photos/Drafts dialogs, the Guide card, a publish confirm) — hide the
// block toolbar so it doesn't float over them.
const OVERLAY_SELECTOR = '[role="dialog"],[role="alertdialog"],[role="menu"]';

const TOOLBAR_H = 32; // approximate toolbar height in px
const GAP = 4;

// ---------------------------------------------------------------------------
// useBlockAnchor — rAF loop tracking the block rect + the canvas viewport band
// + whether an editor overlay is open. Only re-renders on actual change.
// ---------------------------------------------------------------------------

type Anchor = {
  blockTop: number;
  blockBottom: number;
  blockRight: number;
  canvasTop: number;
  canvasBottom: number;
  overlayOpen: boolean;
};

function sameAnchor(a: Anchor | null, b: Anchor | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.blockTop === b.blockTop &&
    a.blockBottom === b.blockBottom &&
    a.blockRight === b.blockRight &&
    a.canvasTop === b.canvasTop &&
    a.canvasBottom === b.canvasBottom &&
    a.overlayOpen === b.overlayOpen
  );
}

function useBlockAnchor(id: string | undefined): Anchor | null {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<Anchor | null>(null);

  useEffect(() => {
    if (typeof document === "undefined" || !id) {
      // Defer via rAF (never setState synchronously inside the effect body).
      const raf = requestAnimationFrame(() => {
        lastRef.current = null;
        setAnchor(null);
      });
      return () => cancelAnimationFrame(raf);
    }

    function commit(next: Anchor | null) {
      if (sameAnchor(lastRef.current, next)) return;
      lastRef.current = next;
      setAnchor(next);
    }

    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-puck-component="${id}"]`);
      const canvas = document.querySelector<HTMLElement>('[data-tour-id="canvas"]');
      if (!el || !el.isConnected || !canvas) {
        commit(null);
      } else {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          commit(null);
        } else {
          const c = canvas.getBoundingClientRect();
          commit({
            blockTop: r.top,
            blockBottom: r.bottom,
            blockRight: r.right,
            canvasTop: c.top,
            canvasBottom: c.bottom,
            overlayOpen: !!document.querySelector(OVERLAY_SELECTOR),
          });
        }
      }
      rafRef.current = requestAnimationFrame(measure);
    }

    rafRef.current = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  return anchor;
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
      className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
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

  const anchor = useBlockAnchor(blockId);

  if (!selectedItem || !itemSelector) return null;

  const actions: BlockActions | null = selectedBlockActions(itemSelector, rootLen);
  if (!actions) return null;

  // No rect yet (avoids a flash at 0,0) or an editor panel is open → hide.
  if (!anchor || anchor.overlayOpen) return null;

  // Hide once the block has scrolled out of the canvas viewport, so the toolbar
  // never floats over the header / section tabs (above) or below the canvas.
  const outOfView =
    anchor.blockBottom <= anchor.canvasTop || anchor.blockTop >= anchor.canvasBottom;
  if (outOfView) return null;

  // Prefer above the block; invert to just-inside the top edge when there isn't
  // room above within the canvas viewport. Clamp into the canvas band either way.
  const above = anchor.blockTop - TOOLBAR_H - GAP;
  let top = above >= anchor.canvasTop ? above : anchor.blockTop + GAP;
  if (top < anchor.canvasTop) top = anchor.canvasTop + GAP;
  if (top + TOOLBAR_H > anchor.canvasBottom) return null;

  const left = anchor.blockRight;
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
      className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1 shadow-none"
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
