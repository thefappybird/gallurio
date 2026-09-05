"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PopupLayout, ImageModalLayout } from "@/lib/page-builder/types";
import type { PickerItem } from "@/lib/page-builder/galleryPicker/types";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { computeAnchoredPanelPosition } from "@/lib/page-builder/anchoredPanelPosition";
import {
  closeLayoutPreview,
  getActiveLayoutPreviewAnchor,
  getActiveLayoutPreviewPayload,
  openLayoutPreview,
  useActiveLayoutPreview,
} from "@/lib/page-builder/layoutPreviewStore";

// ---------------------------------------------------------------------------
// Generic selectable-tile grid (radiogroup)
// ---------------------------------------------------------------------------

export type LayoutPickerOption = {
  id: string;
  label: string;
  description: string;
};

type LayoutPickerProps = {
  /** Accessible name for the radiogroup, e.g. "Featured work layout". */
  ariaLabel: string;
  options: readonly LayoutPickerOption[];
  value: string;
  onChange: (id: string) => void;
  /**
   * Small schematic for a tile / the enlarged preview card. `images` is only
   * ever passed by `LayoutPreviewCard` (real workspace photos, once loaded)
   * — tiles always call this with no images so they stay cheap abstract
   * schematics.
   */
  renderThumb: (id: string, images?: string[]) => ReactNode;
  /**
   * Opt-in: close the shared preview card as soon as the pointer leaves a
   * tile — including when it moves onto the card itself (the card can
   * overlap a neighboring tile since it anchors `preferredSide: "start"`).
   * Off by default so the sidebar preset pickers keep their sticky behavior
   * (`presetPreviewStore` / `PresetPreviewCard`, untouched by this prop).
   */
  closeOnPointerLeave?: boolean;
};

// Tags the tile's anchor element with whether its preview opted into
// close-on-leave — read back by `LayoutPreviewCard` via
// `getActiveLayoutPreviewAnchor()` (already tracked by the store) so the one
// shared card, which has no per-instance prop of its own, knows whether to
// also close itself when the pointer enters the card. A DOM attribute, not
// module-level React state, so this stays outside `layoutPreviewStore.ts`.
const CLOSE_ON_LEAVE_ATTR = "closeOnLeave";

/**
 * A row of selectable schematic tiles (`role="radiogroup"` of `role="radio"`).
 * Arrow/Home/End keys move selection like a native radio group.
 *
 * Hovering, focusing, or clicking a tile opens `LayoutPreviewCard` — a single
 * shared card (see `layoutPreviewStore.ts`), anchored beside the tile and
 * showing the real layout with real workspace photos. Render exactly ONE
 * `<LayoutPreviewCard />` per page that uses `LayoutPicker`, not one per
 * instance.
 */
export function LayoutPicker({
  ariaLabel,
  options,
  value,
  onChange,
  renderThumb,
  closeOnPointerLeave = false,
}: LayoutPickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const reactId = useId();

  const selectedId = options.some((o) => o.id === value) ? value : options[0]?.id;

  function focusTile(id: string) {
    groupRef.current?.querySelector<HTMLElement>(`[data-tile-id="${id}"]`)?.focus();
  }

  function openTilePreview(option: LayoutPickerOption, anchorEl: HTMLElement) {
    anchorEl.dataset[CLOSE_ON_LEAVE_ATTR] = closeOnPointerLeave ? "true" : "false";
    openLayoutPreview(`${reactId}:${option.id}`, anchorEl, {
      label: option.label,
      description: option.description,
      renderThumb: (images) => renderThumb(option.id, images),
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (options.length === 0) return;
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIndex = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = options.length - 1;
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(options[index].id);
      return;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      const next = options[nextIndex];
      onChange(next.id);
      focusTile(next.id);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={ariaLabel}
        className="grid grid-cols-2 gap-2"
      >
        {options.map((option, index) => {
          const selected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              data-tile-id={option.id}
              tabIndex={selected ? 0 : -1}
              onClick={(e) => {
                onChange(option.id);
                openTilePreview(option, e.currentTarget);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onMouseEnter={(e) => openTilePreview(option, e.currentTarget)}
              onFocus={(e) => openTilePreview(option, e.currentTarget)}
              onMouseLeave={() => {
                if (closeOnPointerLeave) closeLayoutPreview();
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 border bg-background p-2 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected ? "border-brand ring-1 ring-brand" : "border-border hover:bg-accent/40",
              )}
            >
              <span aria-hidden className="flex h-[76px] w-full items-center justify-center text-muted-foreground">
                {renderThumb(option.id)}
              </span>
              <span className="text-xs font-medium text-foreground">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The single shared preview card — real photos, anchored, one per page.
// ---------------------------------------------------------------------------

const PREVIEW_IMAGE_LIMIT = 6;
const CARD_WIDTH = 240;
const CARD_MAX_HEIGHT = 200;
const CARD_GAP = 8;

type PreviewImagesState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; urls: string[] };

/**
 * The one enlarged-preview card for every `LayoutPicker` on the page.
 * Rendered once by the caller (e.g. `CollectionsPopupPanelDialog`), not per
 * tile and not per `LayoutPicker` instance — mirrors `PresetPreviewPanel`.
 *
 * Fetches a handful of the workspace's own gallery photos once, from the
 * same owner endpoint the media picker's "All Photos" feed uses, and fills
 * the active tile's schematic photo slots with them. Loading/empty/error all
 * fall back to the flat abstract schematic — never a gradient, spinner, or
 * broken-image icon.
 */
export function LayoutPreviewCard() {
  const activeKey = useActiveLayoutPreview();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [previewImages, setPreviewImages] = useState<PreviewImagesState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portfolio/gallery/collections/all?limit=${PREVIEW_IMAGE_LIMIT}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: PickerItem[] };
        if (cancelled) return;
        if (!data.items || data.items.length === 0) {
          setPreviewImages({ status: "empty" });
          return;
        }
        setPreviewImages({
          status: "ready",
          urls: data.items.map((item) => imageDeliveryUrl(item.publicId, { width: 240, fit: "cover" })),
        });
      } catch {
        if (!cancelled) setPreviewImages({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived during render, not in an effect — see `anchoredPanelPosition.ts`.
  // Prefers the start side (left in LTR): this panel is a right-hand
  // sidebar, so opening toward the canvas is the side that has room.
  const pos = useMemo(() => {
    if (!activeKey) return null;
    const anchor = getActiveLayoutPreviewAnchor();
    if (!anchor) return null;
    const dir = typeof document !== "undefined" && document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    return computeAnchoredPanelPosition({
      anchorRect: anchor.getBoundingClientRect(),
      panelWidth: CARD_WIDTH,
      panelMaxHeight: CARD_MAX_HEIGHT,
      gap: CARD_GAP,
      preferredSide: "start",
      dir,
    });
  }, [activeKey]);

  useEffect(() => {
    if (!activeKey) return;
    const onPointerDown = (e: Event) => {
      if (cardRef.current?.contains(e.target as Node | null)) return;
      closeLayoutPreview();
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeLayoutPreview();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [activeKey]);

  if (!activeKey) return null;
  const payload = getActiveLayoutPreviewPayload();
  if (!payload) return null;
  const urls = previewImages.status === "ready" ? previewImages.urls : undefined;

  return (
    <div
      ref={cardRef}
      data-layout-preview-card="true"
      role="tooltip"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 60,
        width: CARD_WIDTH,
        height: "fit-content",
      }}
      // Flat per DESIGN.md — hairline ring and a tonal shift, no shadow.
      className="border border-border bg-popover text-popover-foreground"
      onMouseEnter={() => {
        const anchor = getActiveLayoutPreviewAnchor();
        if (anchor?.dataset[CLOSE_ON_LEAVE_ATTR] === "true") closeLayoutPreview();
      }}
    >
      <div className="flex h-24 w-full items-center justify-center overflow-hidden bg-muted p-3 text-muted-foreground ring-1 ring-foreground/10">
        {payload.renderThumb(urls)}
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        <span className="text-xs font-medium text-foreground">{payload.label}</span>
        <span className="text-xs text-muted-foreground">{payload.description}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schematic thumbnails — pure divs, currentColor, no bundled images.
// Shared by the small tile (never gets `images`) and the enlarged preview
// (gets real workspace photo URLs once loaded). A "photo slot" cell renders
// the photo when given one; a "chrome" cell (caption bar, sidebar, metadata
// sheet) always stays a flat tint — it isn't a photograph in the real layout.
// ---------------------------------------------------------------------------

type ThumbProps = { images?: string[] };

function pick(images: string[] | undefined, index: number): string | undefined {
  if (!images || images.length === 0) return undefined;
  return images[index % images.length];
}

/** One schematic cell. Photo slot when `url` is given, flat tint otherwise. */
function Cell({ className, url }: { className?: string; url?: string }) {
  return (
    <div
      className={cn(
        "border bg-cover bg-center",
        url ? "border-current/30" : "border-current/50 bg-current/10",
        className,
      )}
      style={url ? { backgroundImage: `url(${url})` } : undefined}
    />
  );
}

function ContactSheetThumb({ images }: ThumbProps) {
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <Cell key={i} url={pick(images, i)} />
      ))}
    </div>
  );
}

function JustifiedThumb({ images }: ThumbProps) {
  let i = 0;
  const next = () => pick(images, i++);
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div className="flex h-1/3 gap-1">
        <Cell className="flex-[2]" url={next()} />
        <Cell className="flex-1" url={next()} />
      </div>
      <div className="flex h-1/3 gap-1">
        <Cell className="flex-1" url={next()} />
        <Cell className="flex-1" url={next()} />
        <Cell className="flex-1" url={next()} />
      </div>
      <div className="flex h-1/3 gap-1">
        <Cell className="flex-1" url={next()} />
        <Cell className="flex-[2]" url={next()} />
      </div>
    </div>
  );
}

function SplitIndexThumb({ images }: ThumbProps) {
  let i = 0;
  const next = () => pick(images, i++);
  return (
    <div className="flex h-full w-full gap-1">
      <Cell className="h-full w-[38%]" url={next()} />
      <div className="grid h-full flex-1 grid-cols-2 grid-rows-2 gap-1">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Cell key={idx} url={next()} />
        ))}
      </div>
    </div>
  );
}

function ImmersiveThumb({ images }: ThumbProps) {
  let i = 0;
  const next = () => pick(images, i++);
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <Cell className="h-[72%] w-full" url={next()} />
      <div className="flex h-[22%] gap-1">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Cell key={idx} className="flex-1" url={next()} />
        ))}
      </div>
    </div>
  );
}

const POPUP_LAYOUT_THUMBS: Record<PopupLayout, (images?: string[]) => ReactNode> = {
  "contact-sheet": (images) => <ContactSheetThumb images={images} />,
  justified: (images) => <JustifiedThumb images={images} />,
  "split-index": (images) => <SplitIndexThumb images={images} />,
  immersive: (images) => <ImmersiveThumb images={images} />,
};

/** Renders the schematic for a `PopupLayout` id. Falls back to contact-sheet. */
export function renderPopupLayoutThumb(id: string, images?: string[]): ReactNode {
  const render = POPUP_LAYOUT_THUMBS[id as PopupLayout] ?? POPUP_LAYOUT_THUMBS["contact-sheet"];
  return render(images);
}

// caption bar / sidebar panel / metadata sheet are chrome, not photo slots —
// they never receive a URL, even in the enlarged preview.
function CaptionThumb({ images }: ThumbProps) {
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <Cell className="h-[78%] w-full" url={pick(images, 0)} />
      <Cell className="h-[14%] w-full" />
    </div>
  );
}

function SidebarThumb({ images }: ThumbProps) {
  return (
    <div className="flex h-full w-full gap-1">
      <Cell className="h-full flex-1" url={pick(images, 0)} />
      <Cell className="h-full w-[26%]" />
    </div>
  );
}

function CinemaThumb({ images }: ThumbProps) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <Cell className="h-full w-full" url={pick(images, 0)} />
      <ChevronLeftIcon className="absolute inset-y-0 start-0 my-auto size-3" />
      <ChevronRightIcon className="absolute inset-y-0 end-0 my-auto size-3" />
    </div>
  );
}

function SheetThumb({ images }: ThumbProps) {
  return (
    <div className="relative flex h-full w-full flex-col">
      <Cell className="h-full w-full" url={pick(images, 0)} />
      <div className="absolute inset-x-2 bottom-0 h-[34%] border border-current/60 bg-current/25" />
    </div>
  );
}

const IMAGE_MODAL_LAYOUT_THUMBS: Record<ImageModalLayout, (images?: string[]) => ReactNode> = {
  caption: (images) => <CaptionThumb images={images} />,
  sidebar: (images) => <SidebarThumb images={images} />,
  cinema: (images) => <CinemaThumb images={images} />,
  sheet: (images) => <SheetThumb images={images} />,
};

/** Renders the schematic for an `ImageModalLayout` id. Falls back to caption. */
export function renderImageModalLayoutThumb(id: string, images?: string[]): ReactNode {
  const render = IMAGE_MODAL_LAYOUT_THUMBS[id as ImageModalLayout] ?? IMAGE_MODAL_LAYOUT_THUMBS.caption;
  return render(images);
}
