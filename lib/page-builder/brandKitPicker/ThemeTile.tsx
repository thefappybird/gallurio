"use client";

import { cn } from "@/lib/utils";
import { Trash2Icon, Loader2Icon, PencilIcon, SaveIcon } from "lucide-react";
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
  deleting?: boolean;
  onApply: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  /** When true, the title is replaced by an inline name input + save icon. */
  nameEditing?: boolean;
  nameValue?: string;
  onNameChange?: (v: string) => void;
  onSaveName?: () => void;
  /** Localized label for the inline name input + save icon (button aria-label). */
  saveNameLabel?: string;
  /** Placeholder and aria-label for the inline name input. Falls back to saveNameLabel. */
  namePlaceholder?: string;
  savingName?: boolean;
  /** Inline error message (already localized) shown under the input. */
  nameError?: string | null;
};

/**
 * One unified theme tile. Normally `[thumbnail | title]` with optional edit +
 * delete controls clustered at the top-right. In `nameEditing` mode the title
 * becomes an inline `[input | save]` row for naming/renaming the theme.
 */
export function ThemeTile({
  tile,
  selected,
  editing = false,
  applyLabel,
  deleteLabel,
  editLabel,
  deleting = false,
  onApply,
  onDelete,
  onEdit,
  nameEditing = false,
  nameValue = "",
  onNameChange,
  onSaveName,
  saveNameLabel,
  namePlaceholder,
  savingName = false,
  nameError,
}: Props) {
  const isCurrent = tile.variant === "current";
  const containerClass = cn(
    "relative flex flex-col border transition-colors",
    isCurrent && "border-dashed",
    editing
      ? "border-foreground ring-1 ring-ring"
      : selected
        ? "border-foreground"
        : "border-border"
  );
  const swatch = (
    <span className="flex size-7 shrink-0 overflow-hidden border border-border" aria-hidden>
      <span data-swatch="primary" className="h-full w-1/2" style={{ background: tile.brandKit.primaryColor }} />
      <span data-swatch="accent" className="h-full w-1/2" style={{ background: tile.brandKit.accentColor }} />
    </span>
  );

  if (nameEditing) {
    return (
      <div data-editing={editing || undefined} className={containerClass}>
        <div className="flex items-center gap-2 p-2">
          {swatch}
          <input
            type="text"
            value={nameValue}
            maxLength={60}
            onChange={(e) => onNameChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSaveName?.();
              }
            }}
            placeholder={namePlaceholder ?? saveNameLabel}
            aria-label={namePlaceholder ?? saveNameLabel}
            className="h-7 min-w-0 flex-1 border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            aria-label={saveNameLabel}
            onClick={onSaveName}
            disabled={savingName}
            className="inline-flex size-7 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            {savingName ? (
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <SaveIcon className="size-3.5" aria-hidden />
            )}
          </button>
        </div>
        {nameError && (
          <p role="alert" className="px-2 pb-2 text-xs text-destructive">
            {nameError}
          </p>
        )}
      </div>
    );
  }

  const hasControls = Boolean((editLabel && onEdit) || (deleteLabel && onDelete));
  return (
    <div data-editing={editing || undefined} className={containerClass}>
      <div className="relative flex items-stretch">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={applyLabel}
          onClick={onApply}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-2 p-2 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            hasControls ? "pr-14" : "pr-2"
          )}
        >
          {swatch}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="min-w-0 truncate" title={tile.name}>
              {tile.name}
            </span>
          </span>
        </button>

        {hasControls && (
          <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
            {editLabel && onEdit && (
              <button
                type="button"
                aria-label={editLabel}
                onClick={onEdit}
                className="inline-flex size-5 items-center justify-center border border-border bg-background text-muted-foreground opacity-70 transition-opacity transition-colors hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                className="inline-flex size-5 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:text-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2Icon className="size-3 animate-spin" aria-hidden />
                ) : (
                  <Trash2Icon className="size-3" aria-hidden />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
