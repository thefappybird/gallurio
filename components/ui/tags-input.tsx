"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { tagBorderClass } from "@/components/app/tag-pill";
import { cn } from "@/lib/utils";

function commitToken(current: string[], raw: string, maxTagLength: number, maxTags: number | undefined): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return current;
  if (maxTags != null && current.length >= maxTags) return current;
  const clipped = trimmed.slice(0, maxTagLength);
  if (current.includes(clipped)) return current;
  return [...current, clipped];
}

export function TagsInput({
  id,
  tags,
  onChange,
  placeholder,
  maxTags,
  maxTagLength = 40,
  colorize = false,
  disabled,
  removeLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Omit for no count cap. */
  maxTags?: number;
  maxTagLength?: number;
  /** true = hash-colored border per tag via tagBorderClass (components/app/tag-pill.tsx);
   *  false (default) = flat border-border. */
  colorize?: boolean;
  disabled?: boolean;
  removeLabel: (tag: string) => string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = useState("");
  const atCap = maxTags != null && tags.length >= maxTags;

  function commitDraft() {
    const next = commitToken(tags, draft, maxTagLength, maxTags);
    setDraft("");
    if (next !== tags) onChange(next);
  }

  function commitPaste(text: string) {
    const parts = text.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
    let next = tags;
    for (const part of parts) {
      next = commitToken(next, part, maxTagLength, maxTags);
    }
    setDraft("");
    if (next !== tags) onChange(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        maxLength={maxTagLength}
        disabled={disabled || atCap}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === " ") {
            e.preventDefault();
            commitDraft();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          commitPaste(e.clipboardData.getData("text"));
        }}
        onBlur={commitDraft}
      />
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <li
              key={`${tag}-${i}`}
              className={cn("inline-flex items-center gap-1 border px-2 py-1 text-xs", colorize ? tagBorderClass(tag) : "border-border")}
            >
              <span>{tag}</span>
              <button
                type="button"
                aria-label={removeLabel(tag)}
                disabled={disabled}
                onClick={() => onChange(tags.filter((_, j) => j !== i))}
                className="inline-flex size-4 items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <XIcon className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
