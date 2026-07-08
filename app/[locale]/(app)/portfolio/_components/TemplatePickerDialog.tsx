"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

export function TemplatePickerDialog({
  open,
  onOpenChange,
  templates,
  currentTemplateId,
  isCanvasMatchingSeed = false,
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
  /**
   * True only when the active canvas data exactly matches the seed that was applied
   * for currentTemplateId. False hides the "Current" badge (canvas has been edited
   * since the template was applied, so calling it "current" would be misleading).
   */
  isCanvasMatchingSeed?: boolean;
  switching: boolean;
  error: string | null;
  onConfirm: (templateId: string) => void;
  /** When true, shows welcome heading/copy for brand-new users and a "Start from scratch" option. */
  welcome?: boolean;
  /** Called when the user picks "Start from scratch" (only visible when welcome=true). */
  onStartScratch?: () => void;
}) {
  const t = useTranslations("app.pageBuilder.editor");
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

  const title = welcome ? t("templatePicker.welcomeTitle") : t("templatePicker.title");
  const subtitle = welcome ? t("templatePicker.welcomeSubtitle") : t("templatePicker.subtitle");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // In welcome mode, any close attempt falls back to scratch in the parent.
        if (welcome) {
          if (!next && !switching) onOpenChange(false);
          return;
        }
        // In normal switcher mode, allow close unless switching.
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
              const isCurrent = !welcome && tpl.id === currentTemplateId && isCanvasMatchingSeed;
              const bk = tpl.defaultBrandKit;
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => setPending(tpl)}
                    className={cn(
                      "flex w-full flex-col gap-3 border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
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
                            {t("templatePicker.current")}
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
                {t("templatePicker.scratch")}
              </Button>
              <Button
                type="button"
                onClick={() => pending && onConfirm(pending.id)}
                loading={switching}
                disabled={switching || pending === null}
              >
                {switching ? t("templatePicker.switching") : t("templatePicker.use")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={switching}>
                {t("templatePicker.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => pending && onConfirm(pending.id)}
                loading={switching}
                disabled={switching || pending === null}
              >
                {switching ? t("templatePicker.switching") : t("templatePicker.use")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
