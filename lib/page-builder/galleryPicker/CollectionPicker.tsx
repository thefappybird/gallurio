"use client";

import { useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { usePickerData } from "./usePickerData";
import type { PickerCollection } from "./types";

// ---------------------------------------------------------------------------
// Labels — plain strings (no next-intl here; the editor is not wrapped in
// an IntlProvider). New i18n keys are declared at the bottom of the file.
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
  errorPhotoType: "Only JPEG, PNG, WebP, and AVIF photos are accepted.",
  errorPhotoSize: "Each photo must be under 10 MB.",
  errorPhotoDim: "Photos must be at least 600×600px — both width and height must be 600px or more.",
  errorUpload: "Some photos failed to upload.",
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

type CreateFormState =
  | { open: false }
  | { open: true; name: string; images: LocalImage[]; uploading: boolean; saving: boolean; error: string | null };

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
    let typeErr = false;
    let sizeErr = false;

    Array.from(files).forEach((f) => {
      const check = validatePhotoFile(f);
      if (!check.ok) {
        if (check.reason === "type_not_accepted") typeErr = true;
        else sizeErr = true;
      } else {
        valid.push(f);
      }
    });

    const topError = typeErr ? L.errorPhotoType : sizeErr ? L.errorPhotoSize : null;
    if (topError && valid.length === 0) {
      setForm((f) => f.open ? { ...f, error: topError } : f);
      return;
    }

    if (valid.length === 0) return;
    setForm((f) => f.open ? { ...f, uploading: true, error: topError } : f);

    Promise.allSettled(
      valid.map((file) => uploadImage(file, { subfolder: "portfolio" }))
    ).then((results) => {
      const ok: LocalImage[] = [];
      let dimErr = false;
      for (const r of results) {
        if (r.status === "fulfilled") ok.push(r.value);
        else {
          const reason = r.reason instanceof Error ? r.reason.message : "";
          if (reason === "dimension_too_small") dimErr = true;
        }
      }
      setForm((f) =>
        f.open
          ? {
              ...f,
              uploading: false,
              images: [...f.images, ...ok],
              error: dimErr ? L.errorPhotoDim : ok.length === 0 ? L.errorUpload : f.error,
            }
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { id } = (await res.json()) as { id: string };
      onChange(id);
      setForm({ open: false });
      retry(); // refresh picker data
    } catch {
      setForm((f) => f.open ? { ...f, saving: false, error: L.errorCreate } : f);
    }
  }

  // -------------------------------------------------------------------------
  // Drag + drop handlers on the dropzone
  // -------------------------------------------------------------------------

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
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
        <p className="text-sm text-destructive">{L.error}</p>
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
              tabIndex={0}
              aria-label={dragOver ? L.dropZoneActive : L.dropZone}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              className={cn(
                "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-4 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
            setForm({ open: true, name: "", images: [], uploading: false, saving: false, error: null })
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
