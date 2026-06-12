"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DraftNameEditor({
  name,
  onCommit,
  error,
}: {
  name: string;
  onCommit: (next: string) => void;
  error: string | null;
}) {
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

  return (
    <div className="flex flex-col gap-0.5">
      {editing ? (
        <div className="flex items-center gap-1">
          {/* autoFocus used in place of ref because Input does not forwardRef */}
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus
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
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-sm font-medium" title={name}>
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
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
