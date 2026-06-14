"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EditorTemplateSummary } from "./EditorShell";

// Plain strings — Puck editor chrome is English (see RELEASE-CHECKLIST §4f).
const L = {
  title: "Choose a template",
  subtitle:
    "Switching applies a starter layout, colors, and fonts. Your photos and collections stay; only the page layout and theme change.",
  current: "Current",
  use: "Use this template",
  cancel: "Cancel",
  switching: "Switching…",
  error: "Could not switch the template. Please try again.",
};

export function TemplatePickerDialog({
  open,
  onOpenChange,
  templates,
  currentTemplateId,
  switching,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EditorTemplateSummary[];
  currentTemplateId: string;
  switching: boolean;
  error: string | null;
  onConfirm: (templateId: string) => void;
}) {
  const [pending, setPending] = useState<EditorTemplateSummary | null>(null);

  // Clear pending selection whenever the picker closes (including the success
  // path where EditorShell closes it) so stale selection can't linger.
  // Adjusting state during render on a prop change is the documented React
  // pattern ("You Might Not Need an Effect") and avoids a cascading effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setPending(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (switching ? undefined : onOpenChange(next))}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{L.subtitle}</p>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => {
              const isCurrent = tpl.id === currentTemplateId;
              const bk = tpl.defaultBrandKit;
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => setPending(tpl)}
                    className={cn(
                      "flex w-full flex-col gap-3 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                      pending?.id === tpl.id
                        ? "border-foreground ring-1 ring-ring"
                        : isCurrent
                          ? "border-foreground"
                          : "border-border hover:bg-accent/40 focus-visible:bg-accent/40"
                    )}
                  >
                    {/* Mini preview built from the template palette (no asset fetch). */}
                    <span
                      className="flex h-24 w-full flex-col justify-end gap-1.5 border border-border p-2"
                      style={{ background: bk.backgroundColor }}
                      aria-hidden
                    >
                      <span className="h-2 w-1/2" style={{ background: bk.foregroundColor }} />
                      <span className="h-1.5 w-3/4" style={{ background: bk.foregroundColor, opacity: 0.45 }} />
                      <span className="mt-1 h-4 w-20" style={{ background: bk.accentColor }} />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{tpl.label}</span>
                        {isCurrent && (
                          <span className="border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                            {L.current}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{tpl.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={switching}>
            {L.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => pending && onConfirm(pending.id)}
            loading={switching}
            disabled={switching || pending === null}
          >
            {switching ? L.switching : L.use}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
