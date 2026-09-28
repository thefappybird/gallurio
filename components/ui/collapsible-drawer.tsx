"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
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
  return (
    <Collapsible
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      render={<section className={cn("border border-border bg-card text-card-foreground", className)} />}
    >
      <div className="flex items-stretch gap-2">
        <CollapsibleTrigger
          nativeButton={false}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (
              t.closest("input,select,textarea,button,a,[contenteditable=true]") &&
              t !== e.currentTarget
            ) {
              e.preventBaseUIHandler();
              return;
            }
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-3 text-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          render={<div />}
        >
          <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-panel-open:rotate-180 motion-reduce:transition-none" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="min-w-0">{title}</span>
            {subtitle ? <span className="min-w-0">{subtitle}</span> : null}
          </span>
        </CollapsibleTrigger>
        {actions ? <div className="flex items-center gap-1 pe-3">{actions}</div> : null}
      </div>

      <CollapsiblePanel>
        <div className={cn("border-t border-border px-3 py-3", bodyClassName)}>{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
