"use client";

import { AlertTriangleIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for "this photo's metadata is incomplete" across
 * every picker/manager grid, the post-upload wizard, and any future surface.
 * Missing `altText` is the only trigger (accessibility + modal-rendering
 * signal) — an absent title/caption alone is NOT incomplete.
 */
export function hasIncompleteMetadata(item: { altText?: string | null }): boolean {
  return !item.altText || item.altText.trim().length === 0;
}

/**
 * Warning affordance for a grid tile whose image has incomplete metadata.
 * Opens on hover AND keyboard focus (base-ui Tooltip); the accessible name
 * IS the explanation, so the signal never depends on the triangle's color
 * alone. Callers position it (`className`) to fit whichever tile corner is
 * free — `size-6` by default, matching the other 24px tile controls.
 */
export function IncompleteMetadataBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center border border-border bg-background/90 text-destructive outline-none transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                className
              )}
            />
          }
        >
          <AlertTriangleIcon className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-60 text-left leading-snug">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
