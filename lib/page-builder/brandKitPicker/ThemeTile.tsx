"use client";

import { cn } from "@/lib/utils";
import { Trash2Icon, Loader2Icon, PencilIcon } from "lucide-react";
import type { ThemeTileModel } from "./themeTiles";

type Props = {
  tile: ThemeTileModel;
  selected: boolean;
  /** Marks the tile currently in edit mode (distinct ring). */
  editing?: boolean;
  /** Localized accessible label for the apply button, e.g. "Apply theme: X". */
  applyLabel: string;
  /** Localized label for the delete button; presence enables deletion. */
  deleteLabel?: string;
  /** Localized label for the edit button; presence (saved tiles) enables editing. */
  editLabel?: string;
  /** Short localized "Unsaved" badge for the current tile. */
  currentBadge?: string;
  deleting?: boolean;
  onApply: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
};

/**
 * One unified theme tile: `[thumbnail | title]`. The thumbnail shows two
 * swatches - primary (left) and accent (right). Apply/delete/edit are sibling
 * buttons (never nested). The current variant uses a dashed border + badge.
 */
export function ThemeTile({
  tile,
  selected,
  editing = false,
  applyLabel,
  deleteLabel,
  editLabel,
  currentBadge,
  deleting = false,
  onApply,
  onDelete,
  onEdit,
}: Props) {
  const isCurrent = tile.variant === "current";
  return (
    <div
      data-editing={editing || undefined}
      className={cn(
        "relative flex items-stretch border transition-colors",
        isCurrent && "border-dashed",
        editing
          ? "border-foreground ring-1 ring-ring"
          : selected
            ? "border-foreground"
            : "border-border"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={applyLabel}
        onClick={onApply}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 p-2 pr-7 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="flex size-7 shrink-0 overflow-hidden border border-border" aria-hidden>
          <span
            data-swatch="primary"
            className="h-full w-1/2"
            style={{ background: tile.brandKit.primaryColor }}
          />
          <span
            data-swatch="accent"
            className="h-full w-1/2"
            style={{ background: tile.brandKit.accentColor }}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="min-w-0 truncate" title={tile.name}>
            {tile.name}
          </span>
          {isCurrent && currentBadge && (
            <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {currentBadge}
            </span>
          )}
        </span>
      </button>

      {editLabel && onEdit && (
        <button
          type="button"
          aria-label={editLabel}
          onClick={onEdit}
          className="absolute right-1 top-1 z-10 inline-flex size-5 items-center justify-center border border-border bg-background text-muted-foreground opacity-70 transition-opacity transition-colors hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <PencilIcon className="size-3" aria-hidden />
        </button>
      )}

      {deleteLabel && onDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex w-8 shrink-0 items-center justify-center self-end border-l border-border text-muted-foreground transition-colors hover:text-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          {deleting ? (
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2Icon className="size-3.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
