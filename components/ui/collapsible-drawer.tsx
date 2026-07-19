"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  bodyClassName?: string;
};

export function CollapsibleDrawer({
  title,
  subtitle,
  actions,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  bodyClassName,
}: Props) {
  const bodyId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const expanded = open ?? internalOpen;

  function setExpanded(next: boolean) {
    if (open === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  }

  return (
    <section className={cn("border border-border bg-card text-card-foreground", className)}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronDownIcon
            className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="min-w-0">{title}</span>
            {subtitle ? <span className="min-w-0">{subtitle}</span> : null}
          </span>
        </button>
        {actions ? <div className="flex items-center gap-1 pe-3">{actions}</div> : null}
      </div>

      {expanded ? (
        <div id={bodyId} className={cn("border-t border-border px-3 py-3", bodyClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
