"use client";

import { useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PHOTO_SPEC, validatePhotoFile, PORTFOLIO_PHOTO_MAX_BYTES } from "@/lib/page-builder/photoSpec";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { UploadError, describeUploadErrorEnglish, type UploadErrorDetail } from "@/lib/uploads/uploadError";
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
import type { PickerItem } from "./types";

/** Marks a message as already curated (safe to show verbatim), distinguishing
 *  it from an arbitrary network/fetch error whose raw text should not reach the UI. */
class DisplayError extends Error {}

// Plain strings: Puck editor chrome is intentionally English-only.
const L = {
  title: "New collection",
  nameLabel: "Collection title",
  namePlaceholder: "e.g. Weddings 2024",
  descriptionLabel: "Description (optional)",
  descriptionPlaceholder: "A line or two shown above the photos on your public page.",
  dropZone: "Drag photos here or click to select",
  dropZoneActive: "Drop to upload",
  hint: "JPEG, PNG, WebP or AVIF · max 15 MB · min 600 px",
  uploading: "Uploading…",
  create: "Create collection",
  creating: "Creating…",
  cancel: "Cancel",
  errUpload: "Some photos failed to upload.",
  errCreate: "Could not create the collection. Please try again.",
  removePhoto: "Remove photo",
};

/** Matches the PATCH/POST collection route's `description` cap. */
export const COLLECTION_DESCRIPTION_MAX = 2000;

type LocalImage = {
  assetId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
};

/**
 * Nested dialog for creating one collection. Opened from the Photos &
 * collections manager via "Add new collection". Calls `onCreated` after a
 * successful POST so the parent can refresh and close this layer.
 */
export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Holds the new collection's id once created, so a retry after a failed
  // "copy existing photos" step re-runs only the copy (never re-creates).
  const createdIdRef = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<LocalImage[]>([]);
  const [picked, setPicked] = useState<PickerItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-file upload failures — never collapsed into one message.
  const [fileErrors, setFileErrors] = useState<{ fileName: string; message: string }[]>([]);

  function reset() {
    setName("");
    setDescription("");
    setImages([]);
    setPicked([]);
    setError(null);
    setFileErrors([]);
    createdIdRef.current = null;
  }

  function close() {
    if (saving || uploading) return;
    reset();
    onOpenChange(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
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
      preErrors.push({ fileName: f.name, message: describeUploadErrorEnglish(detail) });
    });
    setFileErrors(preErrors);
    if (valid.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    Promise.allSettled(
      valid.map((file) =>
        uploadImage(file, { subfolder: "portfolio", maxBytes: PORTFOLIO_PHOTO_MAX_BYTES })
      )
    ).then((results) => {
      const ok: LocalImage[] = [];
      const newErrors: { fileName: string; message: string }[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          ok.push(r.value);
          return;
        }
        const detail: UploadErrorDetail = r.reason instanceof UploadError ? r.reason.detail : { code: "network_error" };
        newErrors.push({ fileName: valid[i].name, message: describeUploadErrorEnglish(detail) });
      });
      setImages((prev) => [...prev, ...ok]);
      setUploading(false);
      setFileErrors((prev) => [...prev, ...newErrors]);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function createCollection() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Skip re-creating if a prior attempt created the collection but the
      // existing-photo copy step then failed (retry copies only).
      let newId = createdIdRef.current;
      if (!newId) {
        const res = await fetch("/api/portfolio/gallery/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), description: description.trim(), items: images }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: UploadErrorDetail };
          throw new DisplayError(body.detail ? describeUploadErrorEnglish(body.detail) : L.errCreate);
        }
        const created = await res.json();
        newId = created.id as string;
        createdIdRef.current = newId;
      }
      if (picked.length > 0) {
        const copyRes = await fetch(
          `/api/portfolio/gallery/collections/${newId}/items/copy`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceItemIds: picked.map((p) => p.id) }),
          }
        );
        // Collection exists but copying existing photos failed — keep the dialog
        // open with the error so it isn't silent; the ref lets the user retry
        // the copy without creating a duplicate collection.
        if (!copyRes.ok) {
          setError(L.errUpload);
          return;
        }
      }
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof DisplayError ? err.message : L.errCreate);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <label className="flex flex-col gap-1.5 text-sm">
            <span>
              {L.nameLabel}
              <span className="ms-0.5 text-destructive">*</span>
            </span>
            <input
              type="text"
              value={name}
              placeholder={L.namePlaceholder}
              disabled={saving}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>{L.descriptionLabel}</span>
            <Textarea
              value={description}
              placeholder={L.descriptionPlaceholder}
              maxLength={COLLECTION_DESCRIPTION_MAX}
              disabled={saving}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div
            role="button"
            tabIndex={0}
            aria-label={dragOver ? L.dropZoneActive : L.dropZone}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            className={cn(
              "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-4 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              dragOver
                ? "border-foreground bg-accent/30"
                : "border-border text-muted-foreground hover:bg-accent/20 focus-visible:bg-accent/20"
            )}
          >
            {uploading ? (
              <>
                <Loader2Icon className="size-5 animate-spin" aria-hidden />
                <span>{L.uploading}</span>
              </>
            ) : (
              <>
                <ImagePlusIcon className="size-5" aria-hidden />
                <span>{dragOver ? L.dropZoneActive : L.dropZone}</span>
                <span className="text-xs text-muted-foreground">{L.hint}</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => handleFiles(e.target.files)}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setPickerOpen(true)}
          >
            Select existing photos
          </Button>

          {(images.length > 0 || picked.length > 0) && (
            <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" aria-label="Uploaded photos">
              {images.map((img, i) => (
                <li
                  key={img.assetId}
                  className="relative aspect-square overflow-hidden border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={L.removePhoto}
                    onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <XIcon className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
              {picked.map((p, i) => (
                <li key={`picked-${p.id}`} className="relative aspect-square overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={L.removePhoto}
                    onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <XIcon className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {fileErrors.length > 0 && (
            <ul role="alert" className="flex flex-col gap-0.5 text-xs text-destructive">
              {fileErrors.map((fe, i) => (
                <li key={`${fe.fileName}-${i}`}>
                  <span className="font-medium">{fe.fileName}:</span> {fe.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving || uploading}>
            {L.cancel}
          </Button>
          <Button
            type="button"
            onClick={createCollection}
            loading={saving}
            disabled={saving || uploading || !name.trim()}
          >
            {saving ? L.creating : L.create}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ExistingPhotosPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludePublicIds={[
          ...images.map((i) => i.assetId),
          ...picked.map((p) => p.publicId),
        ]}
        onAdd={(items) =>
          setPicked((prev) => {
            const seen = new Set(prev.map((p) => p.publicId));
            return [...prev, ...items.filter((it) => !seen.has(it.publicId))];
          })
        }
      />
    </Dialog>
  );
}
