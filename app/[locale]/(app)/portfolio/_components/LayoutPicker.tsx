"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PopupLayout, ImageModalLayout } from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Generic selectable-tile grid (radiogroup)
// ---------------------------------------------------------------------------

export type LayoutPickerOption = {
  id: string;
  label: string;
  description: string;
};

type LayoutPickerProps = {
  /** Accessible name for the radiogroup, e.g. "Popup layout". */
  ariaLabel: string;
  options: readonly LayoutPickerOption[];
  value: string;
  onChange: (id: string) => void;
  /** Renders the whole picker (tiles + preview) inert without unmounting it. */
  disabled?: boolean;
  /** Shown under the tiles when disabled, explaining why. */
  disabledNote?: string;
  /** Small schematic for a tile / the enlarged preview. Same renderer, two sizes. */
  renderThumb: (id: string) => ReactNode;
};

/**
 * A row of selectable schematic tiles (`role="radiogroup"` of `role="radio"`).
 * Arrow/Home/End keys move selection like a native radio group. Hovering OR
 * focusing a tile swaps an inline preview panel below the grid — no floating
 * popover, so there is nothing to clip against the viewport.
 */
export function LayoutPicker({
  ariaLabel,
  options,
  value,
  onChange,
  disabled = false,
  disabledNote,
  renderThumb,
}: LayoutPickerProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const reactId = useId();

  const selectedId = options.some((o) => o.id === value) ? value : options[0]?.id;
  const previewOption =
    options.find((o) => o.id === previewId) ?? options.find((o) => o.id === selectedId);

  function focusTile(id: string) {
    groupRef.current?.querySelector<HTMLElement>(`[data-tile-id="${id}"]`)?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled || options.length === 0) return;
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
        aria-disabled={disabled || undefined}
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
              disabled={disabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onMouseEnter={() => setPreviewId(option.id)}
              onMouseLeave={() => setPreviewId((p) => (p === option.id ? null : p))}
              onFocus={() => setPreviewId(option.id)}
              onBlur={() => setPreviewId((p) => (p === option.id ? null : p))}
              className={cn(
                "flex flex-col items-center gap-1.5 border bg-background p-2 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected ? "border-brand ring-1 ring-brand" : "border-border hover:bg-accent/40",
                disabled && "cursor-not-allowed opacity-50 hover:bg-background",
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

      {disabled && disabledNote && (
        <p className="text-xs text-muted-foreground">{disabledNote}</p>
      )}

      {!disabled && previewOption && (
        <div
          className="flex flex-col gap-2 border border-dashed border-border p-2"
          aria-live="polite"
          id={`${reactId}-preview`}
        >
          <div className="relative h-24 w-full overflow-hidden border border-border">
            <div className="absolute inset-0 bg-gradient-to-br from-muted via-border to-muted" />
            <div className="relative flex h-full items-center justify-center p-3 text-muted-foreground">
              {renderThumb(previewOption.id)}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{previewOption.label}</p>
            <p className="text-xs text-muted-foreground">{previewOption.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schematic thumbnails — pure divs, currentColor, no bundled images.
// Shared by the small tile and the enlarged preview (same renderer).
// ---------------------------------------------------------------------------

const CELL = "border border-current/50 bg-current/10";

function ContactSheetThumb() {
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={CELL} />
      ))}
    </div>
  );
}

function JustifiedThumb() {
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div className="flex h-1/3 gap-1">
        <div className={cn("flex-[2]", CELL)} />
        <div className={cn("flex-1", CELL)} />
      </div>
      <div className="flex h-1/3 gap-1">
        <div className={cn("flex-1", CELL)} />
        <div className={cn("flex-1", CELL)} />
        <div className={cn("flex-1", CELL)} />
      </div>
      <div className="flex h-1/3 gap-1">
        <div className={cn("flex-1", CELL)} />
        <div className={cn("flex-[2]", CELL)} />
      </div>
    </div>
  );
}

function SplitIndexThumb() {
  return (
    <div className="flex h-full w-full gap-1">
      <div className={cn("h-full w-[38%]", CELL)} />
      <div className="grid h-full flex-1 grid-cols-2 grid-rows-2 gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={CELL} />
        ))}
      </div>
    </div>
  );
}

function ImmersiveThumb() {
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div className={cn("h-[72%] w-full", CELL)} />
      <div className="flex h-[22%] gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn("flex-1", CELL)} />
        ))}
      </div>
    </div>
  );
}

const POPUP_LAYOUT_THUMBS: Record<PopupLayout, ReactNode> = {
  "contact-sheet": <ContactSheetThumb />,
  justified: <JustifiedThumb />,
  "split-index": <SplitIndexThumb />,
  immersive: <ImmersiveThumb />,
};

/** Renders the schematic for a `PopupLayout` id. Falls back to contact-sheet. */
export function renderPopupLayoutThumb(id: string): ReactNode {
  return POPUP_LAYOUT_THUMBS[id as PopupLayout] ?? POPUP_LAYOUT_THUMBS["contact-sheet"];
}

function CaptionThumb() {
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div className={cn("h-[78%] w-full", CELL)} />
      <div className={cn("h-[14%] w-full", CELL)} />
    </div>
  );
}

function SidebarThumb() {
  return (
    <div className="flex h-full w-full gap-1">
      <div className={cn("h-full flex-1", CELL)} />
      <div className={cn("h-full w-[26%]", CELL)} />
    </div>
  );
}

function CinemaThumb() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className={cn("h-full w-full", CELL)} />
      <ChevronLeftIcon className="absolute inset-y-0 start-0 my-auto size-3" />
      <ChevronRightIcon className="absolute inset-y-0 end-0 my-auto size-3" />
    </div>
  );
}

function SheetThumb() {
  return (
    <div className="relative flex h-full w-full flex-col">
      <div className={cn("h-full w-full", CELL)} />
      <div className={cn("absolute inset-x-2 bottom-0 h-[34%]", CELL, "bg-current/25")} />
    </div>
  );
}

const IMAGE_MODAL_LAYOUT_THUMBS: Record<ImageModalLayout, ReactNode> = {
  caption: <CaptionThumb />,
  sidebar: <SidebarThumb />,
  cinema: <CinemaThumb />,
  sheet: <SheetThumb />,
};

/** Renders the schematic for an `ImageModalLayout` id. Falls back to caption. */
export function renderImageModalLayoutThumb(id: string): ReactNode {
  return IMAGE_MODAL_LAYOUT_THUMBS[id as ImageModalLayout] ?? IMAGE_MODAL_LAYOUT_THUMBS.caption;
}
