"use client";

import { useState } from "react";
import { ImagePlusIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { usePickerData } from "./usePickerData";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import type { PickerCollection } from "./types";

// Plain strings — Puck editor chrome is English (see RELEASE-CHECKLIST §4f).
const L = {
  title: "Photos & collections",
  intro:
    "Group your photos into collections. Use them in Gallery blocks, or pick any single photo as a Hero / CTA background. Add photos here once — pick them anywhere.",
  empty: "No collections yet. Create your first one to get started.",
  loading: "Loading…",
  error: "Could not load your collections.",
  retry: "Retry",
  addNew: "Add new collection",
  photos: "photos",
  done: "Done",
  deleteTitle: "Delete this collection?",
  deleteBody:
    "The photos in this collection will be permanently deleted from your library and cannot be recovered. Any gallery blocks using this collection will show nothing until you point them at another one.",
  deleting: "Deleting…",
  deleteConfirm: "Delete permanently",
  cancel: "Cancel",
  deleteError: "Could not delete the collection. Please try again.",
  deleteCollection: "Delete collection",
};

export function CollectionsManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, retry } = usePickerData();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PickerCollection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPendingDelete(null);
      retry(); // refresh the collections list
    } catch {
      setDeleteError(L.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  const collections: PickerCollection[] = state.status === "ok" ? state.data.collections : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-muted-foreground sm:max-w-prose">{L.intro}</p>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="shrink-0 gap-1.5 self-start"
            >
              <PlusIcon className="size-4" aria-hidden />
              {L.addNew}
            </Button>
          </div>

          {state.status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              {L.loading}
            </div>
          ) : state.status === "error" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-destructive">{L.error}</p>
              <button
                type="button"
                onClick={retry}
                className="self-start text-xs underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {L.retry}
              </button>
            </div>
          ) : collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L.empty}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {collections.map((col) => (
                <li key={col.id} className="group relative flex flex-col overflow-hidden border border-border">
                  <span className="relative aspect-square w-full overflow-hidden bg-muted">
                    {col.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={col.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex size-full items-center justify-center">
                        <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`${L.deleteCollection}: ${col.name}`}
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDelete(col);
                      }}
                      className="absolute right-1 top-1 inline-flex size-8 items-center justify-center border border-border bg-background/90 text-muted-foreground opacity-100 transition-colors hover:bg-destructive hover:text-primary-foreground focus-visible:bg-destructive focus-visible:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    >
                      <Trash2Icon className="size-4" aria-hidden />
                    </button>
                  </span>
                  <span className="flex flex-col gap-0.5 px-2 py-1.5">
                    <span className="truncate text-xs font-medium">{col.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {col.itemCount} {L.photos}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {L.done}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Nested: create a new collection */}
      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          retry();
        }}
      />

      {/* Nested: confirm hard delete */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{L.deleteBody}</AlertDialogDescription>
            {deleteError && (
              <p role="alert" className="text-xs text-destructive">
                {deleteError}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)} disabled={deleting}>
              {L.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} loading={deleting} disabled={deleting}>
              {deleting ? L.deleting : L.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
