"use client";

import { cn } from "@/lib/utils";
import { Trash2Icon, Loader2Icon } from "lucide-react";
import type { ThemeTileModel } from "./themeTiles";

type Props = {
  tile: ThemeTileModel;
  selected: boolean;
  /** Localized accessible label for the apply button, e.g. "Apply theme: X". */
  applyLabel: string;
  /** Localized label for the delete button; presence enables deletion. */
  deleteLabel?: string;
  deleting?: boolean;
  onApply: () => void;
  onDelete?: () => void;
};

/**
 * One unified theme tile: `[thumbnail | title]`. The thumbnail shows two
 * swatches - primary (left) and accent (right). Apply and delete are sibling
 * buttons (never nested) for valid semantics.
 */
export function ThemeTile({
  tile,
  selected,
  applyLabel,
  deleteLabel,
  deleting = false,
  onApply,
  onDelete,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-stretch border transition-colors",
        selected ? "border-foreground" : "border-border"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={applyLabel}
        onClick={onApply}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 p-2 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        <span className="min-w-0 truncate" title={tile.name}>
          {tile.name}
        </span>
      </button>
      {deleteLabel && onDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex w-8 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:text-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
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
