"use client";

import { InfoIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  /** Plain-text explanation shown in the tooltip (also the accessible name). */
  label: string;
};

/**
 * Small far-right `(i)` affordance for a dashboard card/section header. Explains
 * what the section shows. Opens on hover AND keyboard focus (base-ui Tooltip),
 * and the popover uses `bg-foreground text-background` so it stays legible in
 * dark mode.
 */
export function InfoHint({ label }: Props) {
  return (
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-[var(--radius)] text-muted-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <InfoIcon className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="max-w-60 text-left leading-snug">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
