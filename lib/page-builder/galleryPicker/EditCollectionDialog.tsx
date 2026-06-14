"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVerticalIcon, ImagePlusIcon, Loader2Icon, StarIcon, Trash2Icon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { uploadImageToCloudinary } from "@/lib/storage/uploadToCloudinary.client";
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
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

  const colId = collection?.id ?? null;

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
      setError("Could not load this collection's photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && collection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets local state when the dialog opens for a new collection
      setName(collection.name);
      setCoverPublicId(collection.coverPublicId);
      setSelected(new Set());
      setError(null);
      void loadAll(collection.id);
    }
    // loadAll is stable (useCallback with no deps); collection identity drives re-runs
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
      setError("Could not rename the collection.");
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
      setError("Could not set the cover.");
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
      .then((res) => { if (!res.ok) setError("Could not save the new order."); })
      .catch(() => setError("Could not save the new order."));
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
      setError("Could not remove the selected photos.");
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
      setError("Could not delete the selected photos.");
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || !colId) return;
    const valid = Array.from(files).filter((f) => validatePhotoFile(f).ok);
    if (valid.length === 0) return;
    setUploading(true);
    Promise.allSettled(valid.map((f) => uploadImageToCloudinary(f, { subfolder: "portfolio" }))).then(async (results) => {
      const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      for (const up of ok) {
        try {
          const res = await fetch(`/api/portfolio/gallery/items`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...up, collectionId: colId }),
          });
          if (res.ok) {
            const created = (await res.json()) as { id: string; thumbUrl: string; caption: string | null };
            setItems((prev) => [...prev, { id: created.id, publicId: up.cloudinaryPublicId, thumbUrl: created.thumbUrl, caption: created.caption }]);
          } else {
            setError("Some photos could not be added.");
          }
        } catch {
          setError("Some photos could not be added.");
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
      setError("Could not add the selected photos.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[80vh] sm:max-w-3xl">
        <DialogHeader><DialogTitle className="truncate">Edit &quot;{collection.name}&quot;</DialogTitle></DialogHeader>

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
                    <span aria-hidden className="absolute left-0.5 top-0.5 flex size-5 cursor-grab items-center justify-center bg-background/80">
                      <GripVerticalIcon className="size-3.5 text-muted-foreground" />
                    </span>
                    <span className="sr-only">
                      <button type="button" aria-label={`Move ${item.caption || "photo"} earlier`} onClick={() => moveByKeyboard(item.id, -1)} disabled={idx === 0}>up</button>
                      <button type="button" aria-label={`Move ${item.caption || "photo"} later`} onClick={() => moveByKeyboard(item.id, 1)} disabled={idx === items.length - 1}>down</button>
                    </span>
                    <label className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center border border-border bg-background/90">
                      <input type="checkbox" aria-label={`Select ${item.caption || "photo"}`} checked={isSel} onChange={() => toggleSelect(item.id)} />
                    </label>
                    <button
                      type="button"
                      aria-label={`Set ${item.caption || "photo"} as cover`}
                      aria-pressed={isCover}
                      onClick={() => setCover(item)}
                      className={cn("absolute bottom-0.5 left-0.5 inline-flex items-center gap-0.5 border border-border bg-background/90 px-1 py-0.5 text-[10px]", isCover && "bg-foreground text-background")}
                    >
                      <StarIcon className="size-3" aria-hidden /> Cover
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
