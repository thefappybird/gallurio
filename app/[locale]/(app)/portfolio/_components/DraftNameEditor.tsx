"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DraftNameEditorHandle = {
  /** Commit any in-progress edit and return the committed name, or null if nothing was pending. */
  commit(): string | null;
};

export const DraftNameEditor = forwardRef<
  DraftNameEditorHandle,
  { name: string; onCommit: (next: string) => void; error: string | null }
>(function DraftNameEditor({ name, onCommit, error }, ref) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  function commit() {
    const next = value.trim();
    if (!next) {
      cancel();
      return;
    }
    onCommit(next);
    setEditing(false);
  }

  function cancel() {
    setValue(name);
    setEditing(false);
  }

  useImperativeHandle(ref, () => ({
    commit() {
      if (!editing) return null;
      const next = value.trim();
      if (!next) {
        cancel();
        return null;
      }
      onCommit(next);
      setEditing(false);
      return next;
    },
  }));

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {editing ? (
        <div className="flex items-center gap-1">
          {/* autoFocus used in place of ref because Input does not forwardRef */}
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            className="h-7 w-44 text-sm"
            aria-label="Draft name"
            aria-invalid={Boolean(error) || undefined}
          />
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Confirm name"
            onClick={commit}
          >
            <Check />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Cancel rename"
            onClick={cancel}
          >
            <X />
          </Button>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-0.5">
          <span className="portfolio-draft-name-label max-w-24 truncate text-sm font-medium" title={name}>
            {name}
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Rename draft"
            onClick={() => { setValue(name); setEditing(true); }}
          >
            <Pencil />
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[11px] leading-tight text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});
