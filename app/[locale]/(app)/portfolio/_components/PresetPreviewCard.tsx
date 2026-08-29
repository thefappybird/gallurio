"use client";

/**
 * The drawer's section-preset preview.
 *
 * The drawer lists 33 presets in 11 groups. Carrying a one-line description on
 * every row made the list too verbose to scan, so the row is now name-only and
 * the description moved here, next to a picture of what the block actually is.
 *
 * The picture is a LIVE mini-render, not a screenshot: the same preset data and
 * the same Puck config the canvas uses, laid out at desktop width and scaled
 * down into a 16:10 frame. That means it can never go stale when a preset's
 * composition changes, and it follows the workspace's own brand kit — the
 * `--pf-*` vars are threaded in from EditorShell's already-resolved kit.
 *
 * Data-driven blocks (galleries, featured work, contact details) render their
 * empty states here, because a preset ships with no images selected. That is
 * truthful: it is exactly what lands on the page when the block is dragged in.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Render, type Config, type Data } from "@measured/puck";
import { Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SECTION_PRESETS, type SectionPresetKey } from "@/lib/page-builder/blocks/sectionPresets";
import { PF_CONTAINER_NAME } from "@/lib/page-builder/responsive";

/** Long enough that scanning the list with a mouse doesn't flash every row. */
const HOVER_DELAY_MS = 250;

/** Layout width the mini-render lays out at, so container queries resolve desktop. */
const PREVIEW_WIDTH = 1280;
/** Rendered width of the 16:10 frame in the popover. */
export const FRAME_WIDTH = 248;
const FRAME_HEIGHT = Math.round((FRAME_WIDTH * 10) / 16);
const SCALE = FRAME_WIDTH / PREVIEW_WIDTH;

/**
 * One preset, rendered small.
 *
 * `aria-hidden` + `pointer-events: none`: this is decorative. The accessible
 * description is the popover's own text, and nothing inside the miniature
 * should be focusable or clickable at 19% scale.
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
  const data = useMemo(
    () =>
      ({
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
      }) as unknown as Data,
    [presetKey]
  );

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        overflow: "hidden",
        pointerEvents: "none",
        // The brand ground, so a dark kit (Luxury) previews dark rather than
        // showing the app surface through an unpainted section.
        backgroundColor: "var(--pf-color-bg)",
        ...(cssVars as React.CSSProperties),
      }}
    >
      <div
        style={{
          width: PREVIEW_WIDTH,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          // Makes this element the `pfpage` container, so the same
          // container-query rules that drive the canvas and the public page
          // resolve against 1280px here instead of the popover's own width.
          containerType: "inline-size",
          containerName: PF_CONTAINER_NAME,
        }}
      >
        <Render config={config} data={data} />
      </div>
    </div>
  );
}

/**
 * A drawer row: the preset's name (Puck's own item markup) plus the preview
 * affordance.
 *
 * Two ways in, because neither alone covers everyone:
 *   - hovering the row, after a short delay, so scanning the list with a mouse
 *     doesn't flash a popover on every pass;
 *   - a focusable button, which is the only path for keyboard and touch.
 *
 * The button stops `pointerdown` from reaching Puck: the row is a drag source,
 * and a press on the preview control must not begin a drag.
 */
export function PresetDrawerItem({
  presetKey,
  name,
  description,
  dragHint,
  previewLabel,
  config,
  cssVars,
  children,
}: {
  presetKey: SectionPresetKey;
  name: string;
  description: string;
  dragHint: string;
  previewLabel: string;
  config: Config;
  cssVars: Record<string, string>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Clear a pending open on unmount — the drawer re-renders on every category
  // toggle, and a timer that fires after unmount would setState on a dead node.
  useEffect(() => cancel, [cancel]);

  const openSoon = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  }, [cancel]);

  const close = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);

  return (
    <div
      className="flex items-center gap-1"
      onPointerEnter={openSoon}
      onPointerLeave={close}
      // Any press starts a drag; the preview must get out of the way.
      onPointerDown={close}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={previewLabel}
          className="me-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onPointerDown={(e) => e.stopPropagation()}
          onFocus={() => setOpen(true)}
          onBlur={close}
        >
          <Eye className="size-3.5" aria-hidden />
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          // Flat per DESIGN.md — a hairline ring and a tonal shift, no shadow.
          // `pointer-events-none` keeps the panel from ever intercepting a drag
          // that starts on the row underneath it.
          className="pointer-events-none w-auto max-w-[17rem] border-border p-0 shadow-none"
        >
          <PresetPreviewCanvas
            presetKey={presetKey}
            config={config}
            cssVars={cssVars}
            className="border-b border-border"
          />
          <div className="flex flex-col gap-1 p-2.5">
            <span className="text-xs font-medium text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
            <span className="pt-1 text-xs text-muted-foreground/80">{dragHint}</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
