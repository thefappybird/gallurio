"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { GripVerticalIcon, ImagePlusIcon, Loader2Icon, PencilIcon, StarIcon, Trash2Icon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validatePhotoFile, PORTFOLIO_PHOTO_MAX_BYTES } from "@/lib/page-builder/photoSpec";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
import { ImageMetaDialog, type ImageMetaLabels } from "./ImageMetaDialog";
import { useGalleryPickerCache } from "./GalleryPickerCacheContext";
import type { PickerCollection, PickerItem } from "./types";

const PAGE = 48;

export function EditCollectionDialog({
  open, onOpenChange, collection, onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: PickerCollection | null;
  onChanged: () => void;
}) {
  const errMsg = useActionError();
  const tMeta = useTranslations("app.pageBuilder.editor.imageMeta");
  const cache = useGalleryPickerCache();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [coverPublicId, setCoverPublicId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [metaItem, setMetaItem] = useState<PickerItem | null>(null);
  // The pencil button that opened the alt-text dialog — restores focus there on close.
  const metaTriggerRef = useRef<HTMLButtonElement | null>(null);

  const colId = collection?.id ?? null;

  const metaLabels: ImageMetaLabels = {
    title: tMeta("title"),
    altLabel: tMeta("altLabel"),
    altHelp: tMeta("altHelp"),
    altPlaceholder: tMeta("altPlaceholder"),
    counter: (count, max) => tMeta("counter", { count, max }),
    save: tMeta("save"),
    saving: tMeta("saving"),
    cancel: tMeta("cancel"),
    savedToast: tMeta("savedToast"),
    errorMessage: (code) => errMsg(code),
  };

  function handleMetaSaved(updated: PickerItem) {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    if (colId) cache?.bust(colId);
  }

  const loadAll = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const acc: PickerItem[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 50; guard++) {
        const q = new URLSearchParams({ limit: String(PAGE) });
        if (cursor) q.set("cursor", cursor);
        const res = await fetch(`/api/portfolio/gallery/collections/${id}?${q.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null };
        acc.push(...data.items);
        cursor = data.nextCursor;
        if (!cursor) break;
      }
      setItems(acc);
    } catch {
      setError(errMsg("collection_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [errMsg]);

  useEffect(() => {
    if (open && collection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets local state when the dialog opens for a new collection
      setName(collection.name);
      setCoverPublicId(collection.coverPublicId);
      setSelected(new Set());
      setError(null);
      void loadAll(collection.id);
    }
    // Collection identity drives re-runs; loadAll only changes with the error translator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collection?.id]);

  if (!collection || !colId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit collection</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  const nameInvalid = name.trim().length === 0;
  const nameUnchanged = name.trim() === collection.name;

  async function saveName() {
    if (nameInvalid || nameUnchanged || !colId) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      setError(errMsg("collection_rename_failed"));
    } finally {
      setSavingName(false);
    }
  }

  async function setCover(item: PickerItem) {
    if (!colId) return;
    const prev = coverPublicId;
    setCoverPublicId(item.publicId);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverItemId: item.id }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      setCoverPublicId(prev);
      setError(errMsg("cover_set_failed"));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function persistOrder(next: PickerItem[]) {
    void fetch(`/api/portfolio/gallery/collections/${colId}/items/reorder`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedItemIds: next.map((i) => i.id) }),
    })
      .then((res) => { if (!res.ok) setError(errMsg("order_save_failed")); })
      .catch(() => setError(errMsg("order_save_failed")));
  }

  function reorder(fromId: string, toId: string) {
    setItems((prev) => {
      const from = prev.findIndex((p) => p.id === fromId);
      const to = prev.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistOrder(next);
      return next;
    });
  }

  function moveByKeyboard(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      persistOrder(next);
      return next;
    });
  }

  async function removeSelected() {
    if (selected.size === 0 || !colId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}/items/remove`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: [...selected] }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
      onChanged();
    } catch {
      setError(errMsg("photo_remove_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/items/delete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: [...selected] }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
      setConfirmDelete(false);
      onChanged();
    } catch {
      setError(errMsg("photo_remove_failed"));
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || !colId) return;
    const valid = Array.from(files).filter((f) => validatePhotoFile(f, PORTFOLIO_PHOTO_MAX_BYTES).ok);
    if (valid.length === 0) return;
    setUploading(true);
    Promise.allSettled(
      valid.map((f) => uploadImage(f, { subfolder: "portfolio", maxBytes: PORTFOLIO_PHOTO_MAX_BYTES }))
    ).then(async (results) => {
      const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      for (const up of ok) {
        try {
          const res = await fetch(`/api/portfolio/gallery/items`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...up, collectionId: colId }),
          });
          if (res.ok) {
            const created = (await res.json()) as { id: string; thumbUrl: string; caption: string | null };
            setItems((prev) => [...prev, { id: created.id, publicId: up.assetId, thumbUrl: created.thumbUrl, caption: created.caption, altText: null }]);
          } else {
            setError(errMsg("photo_add_failed"));
          }
        } catch {
          setError(errMsg("photo_add_failed"));
        }
      }
      setUploading(false);
      onChanged();
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  async function addExisting(picked: PickerItem[]) {
    if (picked.length === 0 || !colId) return;
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}/items/copy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceItemIds: picked.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: PickerItem[] };
      setItems((prev) => [...prev, ...data.items]);
      onChanged();
    } catch {
      setError(errMsg("photo_add_failed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[80vh] sm:max-w-3xl">
        <DialogHeader>
          {/* This chrome is still English while the surrounding app may be RTL.
              Left unisolated, the neutral quotes reorder around the LTR "Edit"
              under `ar` and the title renders as `"Weddings" Edit`. `dir="ltr"`
              makes the whole title one isolate; the inner <bdi> keeps an
              Arabic-named collection from breaking the quotes back out. */}
          <DialogTitle className="truncate">
            <span dir="ltr" className="inline-block max-w-full truncate align-bottom">
              Edit &quot;<bdi>{collection.name}</bdi>&quot;
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-col-name" className="text-xs font-medium">Collection name</label>
            <div className="flex items-center gap-2">
              <input
                id="edit-col-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 min-w-0 flex-1 border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button type="button" size="sm" variant="brand" disabled={nameInvalid || nameUnchanged || savingName} loading={savingName} onClick={saveName}>Save name</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <ImagePlusIcon className="size-4" aria-hidden />} Upload photos
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>Select existing photos</Button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" tabIndex={-1} onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" aria-hidden /> Loading…</div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No photos in this collection yet.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {items.map((item, idx) => {
                const isCover = item.publicId === coverPublicId;
                const isSel = selected.has(item.id);
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain"); if (from) reorder(from, item.id); }}
                    className={cn("relative aspect-square overflow-hidden border", isSel ? "border-foreground" : "border-border")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.thumbUrl} alt={item.caption ?? ""} className="size-full object-cover" loading="lazy" />
                    <span aria-hidden className="absolute left-0.5 top-0.5 flex size-6 cursor-grab items-center justify-center bg-background/80">
                      <GripVerticalIcon className="size-3.5 text-muted-foreground" />
                    </span>
                    <span className="sr-only">
                      <button type="button" aria-label={`Move ${item.caption || "photo"} earlier`} onClick={() => moveByKeyboard(item.id, -1)} disabled={idx === 0}>up</button>
                      <button type="button" aria-label={`Move ${item.caption || "photo"} later`} onClick={() => moveByKeyboard(item.id, 1)} disabled={idx === items.length - 1}>down</button>
                    </span>
                    <label className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center border border-border bg-background/90">
                      <input type="checkbox" aria-label={`Select ${item.caption || "photo"}`} checked={isSel} onChange={() => toggleSelect(item.id)} />
                    </label>
                    <button
                      type="button"
                      aria-label={`Set ${item.caption || "photo"} as cover`}
                      aria-pressed={isCover}
                      onClick={() => setCover(item)}
                      className={cn("absolute bottom-0.5 left-0.5 inline-flex h-6 items-center gap-0.5 border border-border bg-background/90 px-1 py-0.5 text-[10px]", isCover && "bg-foreground text-background")}
                    >
                      <StarIcon className="size-3" aria-hidden /> Cover
                    </button>
                    <button
                      type="button"
                      aria-label={tMeta("editTrigger", { name: item.caption || tMeta("photoFallback") })}
                      onClick={(e) => {
                        metaTriggerRef.current = e.currentTarget;
                        setMetaItem(item);
                      }}
                      className="absolute bottom-0.5 right-0.5 inline-flex size-6 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <PencilIcon className="size-3" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={removeSelected}>Remove from collection</Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2Icon className="size-4" aria-hidden /> Delete image
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>

      <ExistingPhotosPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludePublicIds={items.map((i) => i.publicId)}
        onAdd={addExisting}
      />

      <ImageMetaDialog
        item={metaItem}
        open={metaItem !== null}
        onOpenChange={(next) => {
          if (!next) setMetaItem(null);
        }}
        onSaved={handleMetaSaved}
        labels={metaLabels}
        triggerRef={metaTriggerRef}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(n) => { if (!n && !busy) setConfirmDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} photo{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the photo from your library and removes it from every collection it appears in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} loading={busy} disabled={busy}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
