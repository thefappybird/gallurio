"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  welcomeTitle: "Pick a template to start",
  welcomeSubtitle:
    "Choose a starter layout to kick off your portfolio. You can switch templates any time.",
  current: "Current",
  use: "Use this template",
  startScratch: "Start from scratch",
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
  welcome = false,
  onStartScratch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EditorTemplateSummary[];
  currentTemplateId: string;
  switching: boolean;
  error: string | null;
  onConfirm: (templateId: string) => void;
  /** When true, shows welcome heading/copy for brand-new users and a "Start from scratch" option. */
  welcome?: boolean;
  /** Called when the user picks "Start from scratch" (only visible when welcome=true). */
  onStartScratch?: () => void;
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

  const title = welcome ? L.welcomeTitle : L.title;
  const subtitle = welcome ? L.welcomeSubtitle : L.subtitle;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // In welcome mode the dialog is non-dismissible (user must pick a template
        // or start from scratch). In normal switcher mode, allow close unless switching.
        if (welcome) return;
        if (!switching) onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl"
        showCloseButton={!welcome}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => {
              const isCurrent = !welcome && tpl.id === currentTemplateId;
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
          {welcome ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onStartScratch?.()}
                disabled={switching}
              >
                {L.startScratch}
              </Button>
              <Button
                type="button"
                onClick={() => pending && onConfirm(pending.id)}
                loading={switching}
                disabled={switching || pending === null}
              >
                {switching ? L.switching : L.use}
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
