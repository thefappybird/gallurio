"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { GridSkeleton } from "./GridSkeleton";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import { EditCollectionDialog } from "./EditCollectionDialog";
import type { PickerCollection } from "./types";

export function CollectionsManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("app.pageBuilder.editor.photosDialog");
  const { state, retry } = usePickerData();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PickerCollection | null>(null);
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
      setDeleteError(t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  const collections: PickerCollection[] = state.status === "ok" ? state.data.collections : [];

  function handleOpenChange(next: boolean) {
    if (!next) setEditing(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {editing ? (
        <EditCollectionDialog
          open
          embedded
          onBack={() => setEditing(null)}
          onOpenChange={(next) => { if (!next) setEditing(null); }}
          collection={editing}
          onChanged={retry}
        />
      ) : (
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-muted-foreground sm:max-w-prose">{t("intro")}</p>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="shrink-0 gap-1.5 self-start"
            >
              <PlusIcon className="size-4" aria-hidden />
              {t("addNew")}
            </Button>
          </div>

          {state.status === "loading" ? (
            <GridSkeleton
              gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              label={t("loading")}
            />
          ) : state.status === "error" ? (
            <div className="flex flex-col gap-2">
              <p role="alert" className="text-sm text-destructive">{t("error")}</p>
              <button
                type="button"
                onClick={retry}
                className="self-start text-xs underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {t("retry")}
              </button>
            </div>
          ) : collections.length === 0 ? (
            <div
              data-testid="collections-empty-state"
              className="flex min-h-52 flex-col items-center justify-center gap-3 border border-dashed border-border p-6 text-center"
            >
              <ImagePlusIcon className="size-7 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {collections.map((col) => (
                <li key={col.id} className="group relative flex flex-col overflow-hidden border border-border">
                  <button
                    type="button"
                    aria-label={t("editAria", { name: col.name })}
                    onClick={() => setEditing(col)}
                    className="flex flex-col text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <span className="relative aspect-square w-full overflow-hidden bg-muted">
                      {col.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={col.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex size-full items-center justify-center">
                          <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5 px-2 py-1.5">
                      <span className="truncate text-xs font-medium">{col.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {col.itemCount} {t("photos")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${t("deleteCollection")}: ${col.name}`}
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(col);
                    }}
                    className="absolute right-1 top-1 inline-flex size-8 items-center justify-center border border-border bg-background/90 text-muted-foreground opacity-100 transition-colors hover:bg-destructive hover:text-primary-foreground focus-visible:bg-destructive focus-visible:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    <Trash2Icon className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("done")}
          </Button>
        </DialogFooter>
        </DialogContent>
      )}

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
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
            {deleteError && (
              <p role="alert" className="text-xs text-destructive">
                {deleteError}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)} disabled={deleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} loading={deleting} disabled={deleting}>
              {deleting ? t("deleting") : t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
