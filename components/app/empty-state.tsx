import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * Shared "no data yet" placeholder for list surfaces (clients, teams,
 * notifications, inquiries, ...). Icon is decorative (aria-hidden); the
 * heading + optional description carry the meaning for screen readers.
 * Pass a real, keyboard-reachable control (e.g. <Button>) as `action`.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 border border-dashed border-border bg-card p-12 text-center",
        className
      )}
    >
      <Icon className="size-8 text-muted-foreground opacity-40" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
