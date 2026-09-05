"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { ArrowLeftIcon, GripVerticalIcon, ImagePlusIcon, Loader2Icon, PencilIcon, StarIcon, Trash2Icon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { COLLECTION_DESCRIPTION_MAX } from "./CreateCollectionDialog";
import { PHOTO_SPEC, validatePhotoFile, PORTFOLIO_PHOTO_MAX_BYTES } from "@/lib/page-builder/photoSpec";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { UploadError, uploadErrorTranslation, type UploadErrorDetail } from "@/lib/uploads/uploadError";
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
import { ImageMetaWizard, type ImageWizardLabels } from "./ImageMetaWizard";
import { hasIncompleteMetadata, IncompleteMetadataBadge } from "./imageMetaCompleteness";
import { useGalleryPickerCache } from "./GalleryPickerCacheContext";
import type { PickerCollection, PickerItem } from "./types";

const PAGE = 48;

export function EditCollectionDialog({
  open, onOpenChange, collection, onChanged, embedded = false, onBack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: PickerCollection | null;
  onChanged: () => void;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const errMsg = useActionError();
  const tMeta = useTranslations("app.pageBuilder.editor.imageMeta");
  const tWizard = useTranslations("app.pageBuilder.editor.imageWizard");
  const cache = useGalleryPickerCache();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  // The collection's `description` isn't in the picker overview list — it only
  // comes back from the paginated collection fetch (loadAll below) — so it
  // starts blank and fills in once that first page resolves.
  const [description, setDescription] = useState("");
  const [descriptionBaseline, setDescriptionBaseline] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [coverPublicId, setCoverPublicId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-file upload failures — never collapsed into one message. Cleared on
  // every new upload attempt and on dialog reopen.
  const [fileErrors, setFileErrors] = useState<{ fileName: string; message: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [metaItem, setMetaItem] = useState<PickerItem | null>(null);
  // The pencil button that opened the alt-text dialog — restores focus there on close.
  const metaTriggerRef = useRef<HTMLButtonElement | null>(null);
  // Post-upload "add details" offer — dismissable, never a gate (spec 10a).
  const [uploadedBatch, setUploadedBatch] = useState<PickerItem[] | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const colId = collection?.id ?? null;

  const wizardLabels: ImageWizardLabels = {
    heading: tWizard("heading"),
    position: (current, total) => tWizard("position", { current, total }),
    fieldTitle: tWizard("fieldTitle"),
    fieldTitlePlaceholder: tWizard("fieldTitlePlaceholder"),
    fieldCaption: tWizard("fieldCaption"),
    fieldCaptionPlaceholder: tWizard("fieldCaptionPlaceholder"),
    fieldAlt: tWizard("fieldAlt"),
    fieldAltHelp: tWizard("fieldAltHelp"),
    fieldAltPlaceholder: tWizard("fieldAltPlaceholder"),
    altCounter: (count, max) => tWizard("altCounter", { count, max }),
    fieldDate: tWizard("fieldDate"),
    fieldLocation: tWizard("fieldLocation"),
    fieldLocationPlaceholder: tWizard("fieldLocationPlaceholder"),
    fieldClient: tWizard("fieldClient"),
    fieldClientPlaceholder: tWizard("fieldClientPlaceholder"),
    fieldTags: tWizard("fieldTags"),
    fieldTagsPlaceholder: tWizard("fieldTagsPlaceholder"),
    fieldTagsHint: tWizard("fieldTagsHint"),
    removeTag: (tag) => tWizard("removeTag", { tag }),
    fieldMeta: tWizard("fieldMeta"),
    fieldMetaHint: tWizard("fieldMetaHint"),
    metaLabelPlaceholder: tWizard("metaLabelPlaceholder"),
    metaValuePlaceholder: tWizard("metaValuePlaceholder"),
    addMetaRow: tWizard("addMetaRow"),
    removeMetaRow: (n) => tWizard("removeMetaRow", { n }),
    savedBadge: tWizard("savedBadge"),
    unsavedBadge: tWizard("unsavedBadge"),
    jumpToPhoto: (n) => tWizard("jumpToPhoto", { n }),
    previous: tWizard("previous"),
    next: tWizard("next"),
    finish: tWizard("finish"),
    close: tWizard("close"),
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
      let desc = "";
      for (let guard = 0; guard < 50; guard++) {
        const q = new URLSearchParams({ limit: String(PAGE) });
        if (cursor) q.set("cursor", cursor);
        const res = await fetch(`/api/portfolio/gallery/collections/${id}?${q.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null; description?: string };
        acc.push(...data.items);
        if (data.description !== undefined) desc = data.description;
        cursor = data.nextCursor;
        if (!cursor) break;
      }
      setItems(acc);
      setDescription(desc);
      setDescriptionBaseline(desc);
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
      setDescription("");
      setDescriptionBaseline("");
      setSelected(new Set());
      setError(null);
      setFileErrors([]);
      setUploadedBatch(null);
      setWizardOpen(false);
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
  const descriptionUnchanged = description === descriptionBaseline;

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

  async function saveDescription() {
    if (descriptionUnchanged || !colId) return;
    setSavingDescription(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error();
      setDescriptionBaseline(description);
      onChanged();
    } catch {
      setError(errMsg("collection_description_failed"));
    } finally {
      setSavingDescription(false);
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

  // Maps a caught upload/API failure to a per-file display message. Never
  // collapses to a bare "couldn't add photo" when a specific reason exists.
  function describeFailure(err: unknown): string {
    const detail: UploadErrorDetail = err instanceof UploadError ? err.detail : { code: "network_error" };
    const { code, params } = uploadErrorTranslation(detail);
    return errMsg(code, params);
  }

  async function describeApiFailure(res: Response): Promise<string> {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: UploadErrorDetail };
    if (body.detail) {
      const { code, params } = uploadErrorTranslation(body.detail);
      return errMsg(code, params);
    }
    return errMsg(body.error ?? "photo_add_failed");
  }

  function handleFiles(files: FileList | null) {
    if (!files || !colId) return;
    const valid: File[] = [];
    const preErrors: { fileName: string; message: string }[] = [];
    Array.from(files).forEach((f) => {
      const check = validatePhotoFile(f, PORTFOLIO_PHOTO_MAX_BYTES);
      if (check.ok) {
        valid.push(f);
        return;
      }
      const detail: UploadErrorDetail =
        check.reason === "type_not_accepted"
          ? { code: "type_not_accepted", mimeType: f.type, acceptedTypes: PHOTO_SPEC.acceptedTypes }
          : { code: "file_too_large", actualBytes: f.size, maxBytes: PORTFOLIO_PHOTO_MAX_BYTES };
      const { code, params } = uploadErrorTranslation(detail);
      preErrors.push({ fileName: f.name, message: errMsg(code, params) });
    });
    setFileErrors(preErrors);
    if (valid.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    Promise.allSettled(
      valid.map((f) => uploadImage(f, { subfolder: "portfolio", maxBytes: PORTFOLIO_PHOTO_MAX_BYTES }))
    ).then(async (results) => {
      const newErrors: { fileName: string; message: string }[] = [];
      const createdItems: PickerItem[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const fileName = valid[i].name;
        if (r.status === "rejected") {
          newErrors.push({ fileName, message: describeFailure(r.reason) });
          continue;
        }
        try {
          const res = await fetch(`/api/portfolio/gallery/items`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...r.value, collectionId: colId }),
          });
          if (res.ok) {
            const created = (await res.json()) as { id: string; thumbUrl: string; caption: string | null };
            const item: PickerItem = {
              id: created.id,
              publicId: r.value.assetId,
              thumbUrl: created.thumbUrl,
              caption: created.caption,
              altText: null,
              ...(r.value.width != null && r.value.height != null
                ? { width: r.value.width, height: r.value.height }
                : {}),
            };
            setItems((prev) => [...prev, item]);
            createdItems.push(item);
          } else {
            newErrors.push({ fileName, message: await describeApiFailure(res) });
          }
        } catch {
          newErrors.push({ fileName, message: errMsg("upload_network_error") });
        }
      }
      setFileErrors((prev) => [...prev, ...newErrors]);
      setUploading(false);
      onChanged();
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (createdItems.length > 0) {
        setUploadedBatch(createdItems);
        setWizardOpen(true);
      }
    });
  }

  async function addExisting(picked: PickerItem[]) {
    if (picked.length === 0 || !colId) return;
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}/items/copy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceItemIds: picked.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error(await describeApiFailure(res));
      const data = (await res.json()) as { items: PickerItem[] };
      setItems((prev) => [...prev, ...data.items]);
      onChanged();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : errMsg("photo_add_failed"));
    }
  }

  // Split into header/body/footer/extras so `embedded` mode can hand these
  // back to CollectionsManagerDialog to slot into ITS OWN single, stable
  // DialogContent (one Popup instance) instead of mounting a second one —
  // see CollectionsManagerDialog.tsx for why that second Popup instance was
  // the bug.
  const header = (
    <DialogHeader>
      {/* This chrome is still English while the surrounding app may be RTL.
          Left unisolated, the neutral quotes reorder around the LTR "Edit"
          under `ar` and the title renders as `"Weddings" Edit`. `dir="ltr"`
          makes the whole title one isolate; the inner <bdi> keeps an
          Arabic-named collection from breaking the quotes back out. */}
      <div className="flex min-w-0 items-center gap-2">
        {embedded && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Back to photos and collections"
            onClick={onBack}
            className="shrink-0"
          >
            <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        )}
        <DialogTitle className="truncate">
          <span dir="ltr" className="inline-block max-w-full truncate align-bottom">
            Edit &quot;<bdi>{collection.name}</bdi>&quot;
          </span>
        </DialogTitle>
      </div>
    </DialogHeader>
  );

  const body = (
    <>
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-col-description" className="text-xs font-medium">Description (optional)</label>
            <Textarea
              id="edit-col-description"
              value={description}
              placeholder="A line or two shown above the photos on your public page."
              maxLength={COLLECTION_DESCRIPTION_MAX}
              disabled={savingDescription}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              disabled={descriptionUnchanged || savingDescription}
              loading={savingDescription}
              onClick={saveDescription}
            >
              Save description
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <ImagePlusIcon className="size-4" aria-hidden />} Upload photos
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>Select existing photos</Button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploading} className="sr-only" tabIndex={-1} onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {fileErrors.length > 0 && (
            <ul role="alert" className="flex flex-col gap-0.5 text-xs text-destructive">
              {fileErrors.map((fe, i) => (
                <li key={`${fe.fileName}-${i}`}>
                  <span className="font-medium">{fe.fileName}:</span> {fe.message}
                </li>
              ))}
            </ul>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" aria-hidden /> Loading…</div>
          ) : (
            <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              <li className="aspect-square">
                <button
                  type="button"
                  data-testid="collection-upload-drop-card"
                  aria-label={dragOverUpload ? "Drop to upload" : "Upload photos"}
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (uploading) return;
                    e.dataTransfer.dropEffect = "copy";
                    setDragOverUpload(true);
                  }}
                  onDragLeave={() => setDragOverUpload(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverUpload(false);
                    if (uploading) return;
                    handleFiles(e.dataTransfer.files);
                  }}
                  className={cn(
                    "flex size-full flex-col items-center justify-center gap-1 border border-dashed px-2 text-center text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60",
                    dragOverUpload
                      ? "border-foreground bg-accent text-accent-foreground"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {uploading ? <Loader2Icon className="size-5 animate-spin" aria-hidden /> : <ImagePlusIcon className="size-5" aria-hidden />}
                  <span>{uploading ? "Uploading…" : "Drop to upload"}</span>
                  {!uploading && <span className="text-[10px] font-normal">or click to browse</span>}
                </button>
              </li>
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
                    <div className="absolute bottom-0.5 end-0.5 flex items-center gap-0.5">
                      {hasIncompleteMetadata(item) && (
                        <IncompleteMetadataBadge label={tMeta("incompleteWarning")} />
                      )}
                      <button
                        type="button"
                        aria-label={tMeta("editTrigger", { name: item.caption || tMeta("photoFallback") })}
                        onClick={(e) => {
                          metaTriggerRef.current = e.currentTarget;
                          setMetaItem(item);
                          setWizardOpen(true);
                        }}
                        className="inline-flex size-6 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <PencilIcon className="size-3" aria-hidden />
                      </button>
                    </div>
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
    </>
  );

  const footer = (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
    </DialogFooter>
  );

  const extras = (
    <>
      <ExistingPhotosPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludePublicIds={items.map((i) => i.publicId)}
        onAdd={addExisting}
      />

      <ImageMetaWizard
        items={metaItem ? [metaItem] : (uploadedBatch ?? [])}
        open={wizardOpen}
        onOpenChange={(next) => {
          setWizardOpen(next);
          if (!next) {
            setUploadedBatch(null);
            setMetaItem(null);
          }
        }}
        onSaved={handleMetaSaved}
        labels={wizardLabels}
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
    </>
  );

  // Embedded mode: hand header/body/footer/extras back as plain JSX so
  // CollectionsManagerDialog can place them inside ITS OWN single
  // <DialogContent> — never mount a second Popup instance here.
  if (embedded) {
    return (
      <>
        {header}
        {body}
        {footer}
        {extras}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[80vh] sm:max-w-3xl">
        {header}
        {body}
        {footer}
      </DialogContent>
      {extras}
    </Dialog>
  );
}
