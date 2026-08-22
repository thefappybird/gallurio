"use client";

import { cn } from "@/lib/utils";

// The yearly saving flag. It used to sit beside the Beta/Monthly/Annual
// toggle, where at 375px it wrapped onto two lines and squeezed the three tabs
// into each other. It now rides on the plan card it describes, next to the
// plan name, so the toggle keeps its full width at every breakpoint.
export function SavePill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "w-fit bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand",
        className
      )}
    >
      {label}
    </span>
  );
}
