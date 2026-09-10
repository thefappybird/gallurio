"use client";

import { useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHOTO_SPEC, validatePhotoFile, PORTFOLIO_PHOTO_MAX_BYTES } from "@/lib/page-builder/photoSpec";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { UploadError, describeUploadErrorEnglish, type UploadErrorDetail } from "@/lib/uploads/uploadError";
import { usePickerData } from "./usePickerData";
import type { PickerCollection } from "./types";

/** Marks a message as already curated (safe to show verbatim), distinguishing
 *  it from an arbitrary network/fetch error whose raw text should not reach the UI. */
class DisplayError extends Error {}

// ---------------------------------------------------------------------------
// Labels — plain strings by choice, not by constraint. Puck portals its field
// panel into the app tree (no separate createRoot), so next-intl context IS
// available here; this chrome simply has not been localized yet.
// ---------------------------------------------------------------------------

const L = {
  loading: "Loading collections…",
  error: "Could not load collections.",
  retry: "Retry",
  empty: "No collections yet.",
  createNew: "Create new collection",
  collectionNameLabel: "Collection title",
  collectionNamePlaceholder: "e.g. Weddings 2024",
  dropZone: "Drag photos here or click to select",
  dropZoneActive: "Drop to upload",
  uploadHint: "Optional — add photos now or upload them later in Gallery.",
  uploading: "Uploading…",
  create: "Create collection",
  creating: "Creating…",
  errorCreate: "Could not create the collection. Please try again.",
  removePhoto: "Remove photo",
  selected: "Selected",
};

type LocalImage = {
  assetId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
};

type FileError = { fileName: string; message: string };

type CreateFormState =
  | { open: false }
  | {
      open: true;
      name: string;
      images: LocalImage[];
      uploading: boolean;
      saving: boolean;
      error: string | null;
      fileErrors: FileError[];
    };

type Props = {
  /** Current collectionId value (empty string = none selected). */
  value: string;
  onChange: (collectionId: string) => void;
};

export function CollectionPicker({ value, onChange }: Props) {
  const { state, retry } = usePickerData();
  const [form, setForm] = useState<CreateFormState>({ open: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  function handleFiles(files: FileList | null) {
    if (!files || !form.open) return;
    const valid: File[] = [];
    const preErrors: FileError[] = [];

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

    setForm((f) => (f.open ? { ...f, fileErrors: preErrors } : f));
    if (valid.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setForm((f) => (f.open ? { ...f, uploading: true } : f));

    Promise.allSettled(
      valid.map((file) =>
        uploadImage(file, { subfolder: "portfolio", maxBytes: PORTFOLIO_PHOTO_MAX_BYTES })
      )
    ).then((results) => {
      const ok: LocalImage[] = [];
      const newErrors: FileError[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          ok.push(r.value);
          return;
        }
        const detail: UploadErrorDetail = r.reason instanceof UploadError ? r.reason.detail : { code: "network_error" };
        newErrors.push({ fileName: valid[i].name, message: describeUploadErrorEnglish(detail) });
      });
      setForm((f) =>
        f.open
          ? { ...f, uploading: false, images: [...f.images, ...ok], fileErrors: [...f.fileErrors, ...newErrors] }
          : f
      );
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // -------------------------------------------------------------------------
  // Create collection
  // -------------------------------------------------------------------------

  async function submitCreate() {
    if (!form.open || !form.name.trim()) return;
    setForm((f) => f.open ? { ...f, saving: true, error: null } : f);

    try {
      const res = await fetch("/api/portfolio/gallery/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          items: form.images,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: UploadErrorDetail };
        throw new DisplayError(body.detail ? describeUploadErrorEnglish(body.detail) : L.errorCreate);
      }
      const { id } = (await res.json()) as { id: string };
      onChange(id);
      setForm({ open: false });
      retry(); // refresh picker data
    } catch (err) {
      const message = err instanceof DisplayError ? err.message : L.errorCreate;
      setForm((f) => f.open ? { ...f, saving: false, error: message } : f);
    }
  }

  // -------------------------------------------------------------------------
  // Drag + drop handlers on the dropzone
  // -------------------------------------------------------------------------

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!form.open || form.uploading) return;
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!form.open || form.uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        <span>{L.loading}</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-2 py-4">
        <p role="alert" className="text-sm text-destructive">{L.error}</p>
        <button
          type="button"
          onClick={retry}
          className="self-start text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {L.retry}
        </button>
      </div>
    );
  }

  const collections: PickerCollection[] = state.status === "ok" ? state.data.collections : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Collection grid */}
      {collections.length === 0 && !form.open ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground">{L.empty}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="listbox" aria-label="Collections">
          {collections.map((col) => {
            const selected = col.id === value;
            return (
              <li key={col.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => onChange(selected ? "" : col.id)}
                  className={cn(
                    "flex w-full flex-col overflow-hidden border text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected ? "border-foreground" : "border-border hover:bg-accent/40 focus-visible:bg-accent/40"
                  )}
                  aria-label={`${col.name}${selected ? ` — ${L.selected}` : ""}`}
                >
                  <span className="relative aspect-square w-full overflow-hidden bg-muted">
                    {col.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={col.coverUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center">
                        <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
                      </span>
                    )}
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-foreground/60">
                        <span className="text-xs font-medium text-background">{L.selected}</span>
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col gap-0.5 px-2 py-1.5">
                    <span className="truncate text-xs font-medium">{col.name}</span>
                    <span className="text-xs text-muted-foreground">{col.itemCount} photos</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create new collection */}
      {form.open ? (
        <div className="flex flex-col gap-3 border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{L.createNew}</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setForm({ open: false })}
              disabled={form.saving}
              className="inline-flex size-7 items-center justify-center border border-border text-muted-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>{L.collectionNameLabel}</span>
            <input
              type="text"
              placeholder={L.collectionNamePlaceholder}
              value={form.name}
              onChange={(e) => setForm((f) => f.open ? { ...f, name: e.target.value } : f)}
              disabled={form.saving}
              className="min-h-11 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
          </label>

          {/* Dropzone */}
          <div>
            <div
              role="button"
              tabIndex={form.uploading ? -1 : 0}
              aria-disabled={form.uploading}
              aria-label={dragOver ? L.dropZoneActive : L.dropZone}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => { if (!form.uploading) fileInputRef.current?.click(); }}
              onKeyDown={(e) => {
                if (!form.uploading && (e.key === "Enter" || e.key === " ")) fileInputRef.current?.click();
              }}
              className={cn(
                "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-4 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                form.uploading && "cursor-wait opacity-60",
                dragOver ? "border-foreground bg-accent/30" : "border-border text-muted-foreground hover:bg-accent/20 focus-visible:bg-accent/20"
              )}
            >
              {form.uploading ? (
                <>
                  <Loader2Icon className="size-5 animate-spin" aria-hidden />
                  <span>{L.uploading}</span>
                </>
              ) : (
                <>
                  <ImagePlusIcon className="size-5" aria-hidden />
                  <span>{dragOver ? L.dropZoneActive : L.dropZone}</span>
                  <span className="text-xs text-muted-foreground">{L.uploadHint}</span>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              disabled={form.uploading}
              className="sr-only"
              onChange={(e) => handleFiles(e.target.files)}
              tabIndex={-1}
            />
          </div>

          {/* Uploaded photo thumbnails */}
          {form.images.length > 0 && (
            <ul className="grid grid-cols-4 gap-1.5" aria-label="Uploaded photos">
              {form.images.map((img, i) => (
                <li key={img.assetId} className="relative aspect-square overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={L.removePhoto}
                    onClick={() =>
                      setForm((f) =>
                        f.open ? { ...f, images: f.images.filter((_, j) => j !== i) } : f
                      )
                    }
                    className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center border border-border bg-background/90 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <XIcon className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {form.error && (
            <p role="alert" className="text-xs text-destructive">
              {form.error}
            </p>
          )}
          {form.fileErrors.length > 0 && (
            <ul role="alert" className="flex flex-col gap-0.5 text-xs text-destructive">
              {form.fileErrors.map((fe, i) => (
                <li key={`${fe.fileName}-${i}`}>
                  <span className="font-medium">{fe.fileName}:</span> {fe.message}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={submitCreate}
            disabled={form.saving || form.uploading || !form.name.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            {form.saving ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                {L.creating}
              </>
            ) : (
              L.create
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            setForm({ open: true, name: "", images: [], uploading: false, saving: false, error: null, fileErrors: [] })
          }
          className="inline-flex min-h-11 items-center gap-2 border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <PlusIcon className="size-4" aria-hidden />
          {L.createNew}
        </button>
      )}
    </div>
  );
}
