"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftSummary } from "../_draftActions";

// Plain strings — Puck editor chrome is English (see RELEASE-CHECKLIST §4f).
const L = {
  title: "Your drafts",
  subtitle:
    "Pick a saved layout to load it onto the canvas. Loading replaces what you're editing now.",
  empty:
    "No drafts yet. Save your current work, or start a new one from a template.",
  active: "Active",
  addNew: "Add new draft",
  close: "Close",
  confirmTitle: "Delete this draft?",
  confirmBody:
    "This permanently removes the saved draft. This can't be undone.",
  confirmAction: "Delete draft",
  cancel: "Cancel",
};

export function DraftsDialog({
  open,
  onOpenChange,
  drafts,
  activeDraftId,
  onApply,
  onDelete,
  onAddNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftSummary[];
  activeDraftId: string | null;
  onApply: (id: string) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<DraftSummary | null>(null);

  // Clear pending delete when the dialog closes so it can't linger.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setPendingDelete(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{L.subtitle}</p>

          {drafts.length === 0 ? (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {L.empty}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((d) => {
                const isActive = d.id === activeDraftId;
                return (
                  <li
                    key={d.id}
                    className={cn(
                      "flex flex-col gap-2 border p-3",
                      isActive ? "border-foreground" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold" title={d.name}>
                        {d.name}
                      </span>
                      {isActive && (
                        <span className="border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                          {L.active}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label={`Apply ${d.name}`}
                        onClick={() => onApply(d.id)}
                      >
                        <Check />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${d.name}`}
                        onClick={() => setPendingDelete(d)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {L.close}
          </Button>
          <Button type="button" onClick={onAddNew}>
            {L.addNew}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{L.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              {L.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              {L.confirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
