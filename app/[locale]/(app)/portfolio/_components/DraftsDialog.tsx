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
import { Check, Loader2, Trash2 } from "lucide-react";
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
  deletingId = null,
  unsavedDraftName = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftSummary[];
  activeDraftId: string | null;
  onApply: (id: string) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
  /** Id of the draft currently being deleted; disables all interactive elements. */
  deletingId?: string | null;
  /** When non-null, an unsaved draft with this name is shown at the top of the list. */
  unsavedDraftName?: string | null;
}) {
  const [pendingDelete, setPendingDelete] = useState<DraftSummary | null>(null);

  // Clear pending delete when the dialog closes so it can't linger.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setPendingDelete(null);
  }

  const isDeleting = deletingId !== null;
  const hasUnsaved = unsavedDraftName !== null;
  // When a delete is in progress, block the dialog from closing.
  const handleOpenChange = (next: boolean) => {
    if (isDeleting) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{L.subtitle}</p>

          {drafts.length === 0 && !hasUnsaved ? (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {L.empty}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Unsaved draft entry — shown at the top when the active draft has no DB record yet */}
              {hasUnsaved && (
                <li className="border-2 border-dashed border-muted-foreground/40 p-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                      <span className="min-w-0 flex-1 truncate font-semibold" title={unsavedDraftName!}>
                        {unsavedDraftName}
                      </span>
                      <span className="shrink-0 border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        Unsaved
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <span className="border border-foreground px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        {L.active}
                      </span>
                    </div>
                  </div>
                </li>
              )}
              {drafts.map((d) => {
                const isActive = d.id === activeDraftId;
                const isBeingDeleted = d.id === deletingId;
                return (
                  <li
                    key={d.id}
                    className={cn(
                      "border p-3",
                      isActive ? "border-foreground" : "border-border"
                    )}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate font-semibold" title={d.name}>
                        {d.name}
                      </span>
                      <div className="flex w-[7.5rem] shrink-0 items-center justify-end gap-1">
                        {isActive && (
                          <span className="border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                            {L.active}
                          </span>
                        )}
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Apply ${d.name}`}
                          title={`Apply ${d.name}`}
                          disabled={isDeleting}
                          onClick={() => onApply(d.id)}
                        >
                          <Check />
                        </Button>
                        {isBeingDeleted ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Deleting ${d.name}`}
                            disabled
                          >
                            <Loader2 className="animate-spin" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete ${d.name}`}
                            title={`Delete ${d.name}`}
                            disabled={isDeleting}
                            onClick={() => setPendingDelete(d)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" disabled={isDeleting} onClick={() => onOpenChange(false)}>
            {L.close}
          </Button>
          <Button type="button" disabled={isDeleting} onClick={onAddNew}>
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
