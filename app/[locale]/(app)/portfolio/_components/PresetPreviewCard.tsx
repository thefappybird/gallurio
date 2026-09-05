"use client";

/**
 * The drawer's section-preset preview.
 *
 * Carrying a one-line description on every preset row made the list too verbose
 * to scan, so the row is name-only and the description moved here, next to a
 * picture of what the block actually is. Manual blocks reuse the same panel but
 * intentionally show only concise explanatory text.
 *
 * The picture is a LIVE mini-render, not a screenshot: the same preset data and
 * the same Puck config the canvas uses, laid out at desktop width and scaled
 * down. It can never go stale when a preset's composition changes, and it
 * follows the workspace's own brand kit — the `--pf-*` vars are threaded in
 * from EditorShell's already-resolved kit.
 *
 * Open/close state is NOT local. It lives in `presetPreviewStore` because Puck
 * renders every drawer item twice (draggable + `Drawer-draggableBg` ghost);
 * per-row state gave each preset two popovers whose pointer handlers fought,
 * which read as flicker. See that module for the interaction contract.
 *
 * Data-driven blocks (galleries, featured work, contact details) render their
 * empty states here, because a preset ships with no images selected. That is
 * truthful: it is exactly what lands on the page when the block is dragged in.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Render, type Config, type Data } from "@measured/puck";
import { SECTION_PRESETS, type SectionPresetKey } from "@/lib/page-builder/blocks/sectionPresets";
import type { ManualBlockKey } from "@/lib/page-builder/blockCategories";
import { mapBlocks } from "@/lib/page-builder/blockTree";
import type { PuckData } from "@/lib/page-builder/types";
import { PF_CONTAINER_NAME } from "@/lib/page-builder/responsive";
import {
  closePresetPreview,
  getActivePresetAnchor,
  openPresetPreview,
  useActivePresetPreview,
} from "@/lib/page-builder/presetPreviewStore";
import { computeAnchoredPanelPosition } from "@/lib/page-builder/anchoredPanelPosition";

/** Breathing room between the anchor row and the panel, and off the viewport edge. */
const PANEL_GAP = 8;
/** Worst-case panel height (capped preview + the three copy lines), used to
 *  clamp placement without having to measure after mount. */
const PANEL_MAX_HEIGHT = 320 + 96;

/**
 * Layout width the mini-render lays out at. Keeping it just above the portfolio
 * tablet breakpoint preserves the real desktop composition while making type
 * legible at thumbnail scale.
 */
export const PREVIEW_WIDTH = 960;
/** Rendered width of the frame in the panel. This is only 32px wider than the
 * original card, but makes the live preset materially easier to judge. */
export const FRAME_WIDTH = 280;
const SCALE = FRAME_WIDTH / PREVIEW_WIDTH;

/**
 * The frame follows the preset's OWN rendered height rather than a fixed 16:10
 * box — a Footer and a Hero are not the same shape, and one ratio either cropped
 * the short ones or over-boxed the tall ones.
 *
 * Presets range from an auto-height footer to a `minHeight: medium` hero
 * (60vh). Short sections keep their exact scaled content height; only the upper
 * bound is capped so an unusually tall future preset cannot consume the drawer.
 */
export const PREVIEW_MIN_HEIGHT = 0;
export const PREVIEW_MAX_HEIGHT = 320;
/** Used until the first measurement lands, so the panel opens at a sane size. */
const PREVIEW_INITIAL_HEIGHT = 168;

/** Convert the preset's untransformed layout height into its visible height. */
export const getPreviewFrameHeight = (layoutHeight: number) =>
  Math.min(PREVIEW_MAX_HEIGHT, Math.max(PREVIEW_MIN_HEIGHT, layoutHeight * SCALE));

/** Build the miniature's Puck tree with deterministic ids at every depth.
 * Preset compositions are pure literals without ids until Puck inserts them;
 * `<Render>` needs ids too so its nested slot lists have stable React keys. */
export function buildPresetPreviewData(presetKey: SectionPresetKey): PuckData {
  let nestedIndex = 0;
  const data: PuckData = {
    root: { props: {} },
    content: [
      {
        type: presetKey,
        props: {
          ...SECTION_PRESETS[presetKey].defaultProps,
          id: `preset-preview-${presetKey}`,
        },
      },
    ],
  };

  return mapBlocks(data, (block) => {
    if (typeof block.props.id === "string" && block.props.id.length > 0) return block;
    return {
      ...block,
      props: { ...block.props, id: `preset-preview-${presetKey}-${nestedIndex++}` },
    };
  });
}

/**
 * One preset, rendered small.
 *
 * `aria-hidden` + `pointer-events: none`: this is decorative. The accessible
 * description is the panel's own text, and nothing inside a miniature scaled to
 * ~19% should be focusable or clickable.
 */
export function PresetPreviewCanvas({
  presetKey,
  config,
  cssVars,
  className,
}: {
  presetKey: SectionPresetKey;
  config: Config;
  cssVars: Record<string, string>;
  className?: string;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>(PREVIEW_INITIAL_HEIGHT);

  // Measure what the preset actually renders, then scale it into the frame.
  // ResizeObserver rather than a one-shot read: images and fonts settle after
  // mount and change the natural height.
  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // `getBoundingClientRect()` already includes the CSS transform. Multiplying
    // that value by SCALE again collapsed every preset to the old 96px floor.
    // offsetHeight is the untransformed layout measurement, so scale it once.
    const measure = () => setHeight(getPreviewFrameHeight(el.offsetHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [presetKey]);

  const data = useMemo(() => buildPresetPreviewData(presetKey) as unknown as Data, [presetKey]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: FRAME_WIDTH,
        height,
        overflow: "hidden",
        pointerEvents: "none",
        // The brand ground, so a dark kit (Luxury) previews dark rather than
        // showing the app surface through an unpainted section.
        backgroundColor: "var(--pf-color-bg)",
        ...(cssVars as React.CSSProperties),
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: PREVIEW_WIDTH,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          // Makes this element the `pfpage` container, so the same
          // container-query rules that drive the canvas and the public page
          // resolve against 1280px here instead of the panel's own width.
          containerType: "inline-size",
          containerName: PF_CONTAINER_NAME,
        }}
      >
        <Render config={config} data={data} metadata={{ presetPreview: true }} />
      </div>
    </div>
  );
}

/**
 * A drawer row. Handlers only — it renders NO panel.
 *
 * Puck mounts every row twice (draggable + `Drawer-draggableBg` ghost). When
 * each mount owned a panel, both agreed to open and the user got two stacked
 * copies of the same card. The panel is rendered once by
 * `PresetPreviewPanel`; a row only reports which preset to show and where.
 *
 * Hovering or clicking opens; doing either on a different row swaps it over.
 * Leaving the row does NOT close — the user must be able to travel toward the
 * panel. Starting a drag closes, so the card never rides along with the block.
 */
export function PresetDrawerItem({
  presetKey,
  children,
}: {
  presetKey: SectionPresetKey;
  children: ReactNode;
}) {
  return <DrawerPreviewTarget itemKey={presetKey}>{children}</DrawerPreviewTarget>;
}

/** Manual rows share the preset interaction contract, but the shared panel
 * intentionally omits the live miniature for these small primitives. */
export function ManualDrawerItem({
  blockKey,
  children,
}: {
  blockKey: ManualBlockKey;
  children: ReactNode;
}) {
  return <DrawerPreviewTarget itemKey={blockKey}>{children}</DrawerPreviewTarget>;
}

function DrawerPreviewTarget({ itemKey, children }: { itemKey: string; children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  const show = useCallback(() => {
    if (rowRef.current) openPresetPreview(itemKey, rowRef.current);
  }, [itemKey]);

  return (
    <div
      ref={rowRef}
      tabIndex={0}
      onPointerEnter={show}
      onClick={show}
      onFocus={show}
      onDragStart={closePresetPreview}
    >
      {children}
    </div>
  );
}

/**
 * The one preview panel for the whole drawer.
 *
 * Rendered once by EditorShell rather than per row, and positioned manually
 * against the anchor the store carries. A popover per row would mean two panels
 * per preset (Puck's duplicate mount), which is the bug this shape prevents by
 * construction.
 *
 * Dismissal is one rule rather than an enumeration of canvas actions: any
 * pointerdown outside the panel closes it, which covers clicking the canvas,
 * another part of the drawer, or the chrome. Escape closes too.
 */
export function PresetPreviewPanel({
  config,
  cssVars,
  describe,
  dragHint,
}: {
  config: Config;
  cssVars: Record<string, string>;
  /** Resolves a preset or manual block key to localized drawer help. */
  describe: (key: string) => { name: string; description: string } | undefined;
  dragHint: string;
}) {
  const activeKey = useActivePresetPreview();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Derived during render, not in an effect: the anchor rect is available
  // synchronously and the clamp uses a known worst-case height, so there is
  // nothing to measure after mount. Prefers the anchor's end side (right in
  // LTR — the drawer sits on the left), flipping to the start side when that
  // cannot fit, and keeps the card inside the viewport near the end of a
  // long drawer. Math lives in `anchoredPanelPosition.ts`, shared with the
  // portfolio layout picker's preview card.
  const pos = useMemo(() => {
    if (!activeKey) return null;
    const anchor = getActivePresetAnchor();
    if (!anchor) return null;
    const dir = typeof document !== "undefined" && document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    return computeAnchoredPanelPosition({
      anchorRect: anchor.getBoundingClientRect(),
      panelWidth: FRAME_WIDTH + 2,
      panelMaxHeight: PANEL_MAX_HEIGHT,
      gap: PANEL_GAP,
      preferredSide: "end",
      dir,
    });
  }, [activeKey]);

  useEffect(() => {
    if (!activeKey) return;
    const onPointerDown = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node | null)) return;
      closePresetPreview();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePresetPreview();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [activeKey]);

  if (!activeKey) return null;
  const copy = describe(activeKey);
  if (!copy) return null;
  const { name, description } = copy;
  const isPreset = activeKey in SECTION_PRESETS;

  return (
    <div
      ref={panelRef}
      data-preset-preview-panel="true"
      role="tooltip"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 60,
        width: FRAME_WIDTH + 2,
        // `.gallurio-editor > div` gives Puck's root height:100%. This panel is
        // also a direct child, so explicitly opt out and hug the rendered card.
        height: "fit-content",
      }}
      // Flat per DESIGN.md — hairline ring and a tonal shift, no shadow.
      className="border border-border bg-popover text-popover-foreground"
    >
      {isPreset && (
        <PresetPreviewCanvas
          presetKey={activeKey as SectionPresetKey}
          config={config}
          cssVars={cssVars}
          className="border-b border-border"
        />
      )}
      <div className="flex flex-col gap-1 p-2.5">
        <span className="text-xs font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
        <span className="pt-1 text-xs text-muted-foreground/80">{dragHint}</span>
      </div>
    </div>
  );
}
