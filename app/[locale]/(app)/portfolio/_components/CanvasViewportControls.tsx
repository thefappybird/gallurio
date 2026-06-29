"use client";

import { Smartphone, Tablet, Monitor, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  useCanvasViewport,
  setCanvasDevice,
  setCanvasZoom,
  stepZoom,
  CANVAS_ZOOM_STEPS,
  type CanvasDevice,
} from "@/lib/page-builder/canvasViewportStore";

const DEVICES: readonly { key: CanvasDevice; Icon: typeof Monitor }[] = [
  { key: "mobile", Icon: Smartphone },
  { key: "tablet", Icon: Tablet },
  { key: "desktop", Icon: Monitor },
] as const;

const MIN_ZOOM = CANVAS_ZOOM_STEPS[0];
const MAX_ZOOM = CANVAS_ZOOM_STEPS[CANVAS_ZOOM_STEPS.length - 1];

/**
 * Edit-canvas breakpoint + zoom controls. Drives the module-level
 * `canvasViewportStore`, which `RootCanvasStyle` reads to clamp the canvas
 * surface width (so container-query blocks reflow live) and apply a CSS zoom.
 * Store-only — no Puck context needed, so it renders anywhere in the toolbar.
 */
export function CanvasViewportControls() {
  const t = useTranslations("app.pageBuilder.editor");
  const { device, zoom } = useCanvasViewport();
  const zoomPct = Math.round(zoom * 100);
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("controls.canvasWidth")}>
      {DEVICES.map(({ key, Icon }) => {
        const label = t(`devices.${key}`);
        return (
          <Button
            key={key}
            type="button"
            size="icon-sm"
            variant={device === key ? "default" : "outline"}
            aria-pressed={device === key}
            aria-label={label}
            title={label}
            onClick={() => setCanvasDevice(key)}
          >
            <Icon className="size-4" aria-hidden />
          </Button>
        );
      })}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={t("controls.zoomOut")}
        title={t("controls.zoomOut")}
        disabled={zoom <= MIN_ZOOM}
        onClick={() => setCanvasZoom(stepZoom(zoom, -1))}
      >
        <ZoomOut className="size-4" aria-hidden />
      </Button>
      <button
        type="button"
        title={t("controls.zoomReset")}
        aria-label={t("controls.zoomReset")}
        onClick={() => setCanvasZoom(1)}
        className="min-w-[3rem] rounded-[var(--radius)] px-1 text-center text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {zoomPct}%
      </button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={t("controls.zoomIn")}
        title={t("controls.zoomIn")}
        disabled={zoom >= MAX_ZOOM}
        onClick={() => setCanvasZoom(stepZoom(zoom, 1))}
      >
        <ZoomIn className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
