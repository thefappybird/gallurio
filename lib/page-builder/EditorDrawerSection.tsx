"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EditorDrawerSection — a single collapsible section for the editor side-panel.
 *
 * Use inside EditorDrawerGroup so the group draws the outer border and dividers.
 * This section has NO own outer border — the group owns the frame.
 */
export function EditorDrawerSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between px-3 text-left text-xs font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && <div className="flex flex-col gap-3 p-3">{children}</div>}
    </div>
  );
}

/**
 * EditorDrawerGroup — wraps EditorDrawerSection children with a single outer
 * border and hairline dividers between sections (flush, Puck-style stacking).
 *
 * No gap between sections — the group is a continuous bordered block.
 */
export function EditorDrawerGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-border divide-y divide-border">{children}</div>
  );
}
