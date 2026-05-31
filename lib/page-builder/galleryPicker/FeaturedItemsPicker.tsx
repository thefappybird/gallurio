"use client";

import { useRef, useState } from "react";
import { GripVerticalIcon, ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { uploadImageToCloudinary } from "@/lib/storage/uploadToCloudinary.client";
import { usePickerData } from "./usePickerData";
import type { PickerItem } from "./types";

// Inline label strings (no next-intl in editor context — the editor shell does
// not wrap the Puck field panel in an IntlProvider).
const L = {
  loading: "Loading photos…",
  error: "Could not load photos.",
  retry: "Retry",
  empty: "No photos yet. Upload some below.",
  uploadMore: "Upload a photo",
  uploading: "Uploading…",
  dropZone: "Drag photos here or click to upload",
  dropZoneActive: "Drop to upload",
  dragHint: "Drag items to reorder",
  maxHint: "Select up to 3 photos",
  errorPhotoType: "Only JPEG, PNG, WebP, and AVIF photos are accepted.",
  errorPhotoSize: "Each photo must be under 10 MB.",
  errorPhotoDim: "Photos must be at least 600px on the shorter side.",
  errorUpload: "Some photos failed to upload.",
  removePhoto: "Remove photo",
  selected: "Selected",
};

const MAX_FEATURED = 3;

type Props = {
  /** Array of { id } objects (Puck array row shape). */
  value: Array<{ id?: string | null } | string>;
  onChange: (next: Array<{ id: string }>) => void;
};

function normalizeIds(raw: Props["value"]): string[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x) => (typeof x === "string" ? x : x?.id))
    .filter((x): x is string => typeof x === "string" && x.length > 0);
}

export function FeaturedItemsPicker({ value, onChange }: Props) {
  const { state, retry } = usePickerData();
  const selectedIds = normalizeIds(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Drag-to-reorder state for the selected strip.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);

  // Local items that were uploaded this session (before picker data refreshes).
  const [localItems, setLocalItems] = useState<PickerItem[]>([]);

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------

  function toggleItem(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : selectedIds.length < MAX_FEATURED
        ? [...selectedIds, id]
        : selectedIds;
    onChange(next.map((x) => ({ id: x })));
  }

  // -------------------------------------------------------------------------
  // Drag-to-reorder selected items
  // -------------------------------------------------------------------------

  function onItemDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onItemDragEnter(id: string) {
    dragOverIdRef.current = id;
  }
  function onItemDragEnd() {
    const from = draggingId;
    const to = dragOverIdRef.current;
    if (from && to && from !== to) {
      const copy = [...selectedIds];
      const fi = copy.indexOf(from);
      const ti = copy.indexOf(to);
      if (fi !== -1 && ti !== -1) {
        copy.splice(fi, 1);
        copy.splice(ti, 0, from);
        onChange(copy.map((x) => ({ id: x })));
      }
    }
    setDraggingId(null);
    dragOverIdRef.current = null;
  }

  // -------------------------------------------------------------------------
  // File upload — browser → Cloudinary → persist GalleryItem via API
  // -------------------------------------------------------------------------

  async function handleFiles(files: FileList | null) {
    if (!files) return;
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
      setUploadError(topError);
      return;
    }
    if (valid.length === 0) return;

    setUploading(true);
    setUploadError(null);

    const results = await Promise.allSettled(
      valid.map((file) => uploadImageToCloudinary(file, { subfolder: "portfolio" }))
    );

    let dimErr = false;
    let generalErr = false;
    const uploadedItems: PickerItem[] = [];
    const newSelectedIds: string[] = [...selectedIds];

    for (const r of results) {
      if (r.status === "rejected") {
        const reason = r.reason instanceof Error ? r.reason.message : "";
        if (reason === "dimension_too_small") dimErr = true;
        else generalErr = true;
        continue;
      }

      // Persist as a GalleryItem via the items API.
      try {
        const createRes = await fetch("/api/portfolio/gallery/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r.value),
        });
        if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);
        const created = (await createRes.json()) as { id: string; thumbUrl: string; caption: string | null };
        uploadedItems.push({ id: created.id, thumbUrl: created.thumbUrl, caption: created.caption });
        // Auto-select if below max.
        if (newSelectedIds.length < MAX_FEATURED) {
          newSelectedIds.push(created.id);
        }
      } catch {
        generalErr = true;
      }
    }

    setLocalItems((prev) => [...prev, ...uploadedItems]);
    onChange(newSelectedIds.map((x) => ({ id: x })));
    setUploading(false);

    if (dimErr) setUploadError(L.errorPhotoDim);
    else if (generalErr) setUploadError(L.errorUpload);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // -------------------------------------------------------------------------
  // Drag + drop for new uploads
  // -------------------------------------------------------------------------

  function onDropzoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDropzoneDragLeave() {
    setDragOver(false);
  }
  function onDropzoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
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

  // Merge fetched items with any locally uploaded ones (deduped by id).
  const fetchedItems: PickerItem[] = state.status === "ok" ? state.data.items : [];
  const localOnly = localItems.filter((li) => !fetchedItems.some((fi) => fi.id === li.id));
  const allItems = [...localOnly, ...fetchedItems];

  const itemById = new Map(allItems.map((it) => [it.id, it]));

  return (
    <div className="flex flex-col gap-4">
      {/* Selected items strip with drag-to-reorder */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            {selectedIds.length}/{MAX_FEATURED} · {L.dragHint}
          </p>
          <ul className="flex gap-2" aria-label="Selected photos (drag to reorder)">
            {selectedIds.map((id) => {
              const item = itemById.get(id);
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={(e) => onItemDragStart(e, id)}
                  onDragEnter={() => onItemDragEnter(id)}
                  onDragEnd={onItemDragEnd}
                  className={cn(
                    "relative aspect-square w-20 shrink-0 overflow-hidden border border-border cursor-grab active:cursor-grabbing",
                    draggingId === id && "opacity-50"
                  )}
                >
                  {item ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">?</span>
                  )}
                  {/* Visible drag affordance */}
                  <span
                    aria-hidden
                    className="absolute left-0.5 top-0.5 flex size-5 items-center justify-center bg-background/80"
                  >
                    <GripVerticalIcon className="size-3.5 text-muted-foreground" />
                  </span>
                  <button
                    type="button"
                    aria-label={L.removePhoto}
                    onClick={() => toggleItem(id)}
                    className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center border border-border bg-background/90 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <XIcon className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Hint */}
      <p className="text-xs text-muted-foreground">{L.maxHint}</p>

      {/* All workspace items (thumbnail grid for picking) */}
      {allItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L.empty}</p>
      ) : (
        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="listbox" aria-label="Gallery photos">
          {allItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const atMax = selectedIds.length >= MAX_FEATURED;
            const disabled = !isSelected && atMax;
            return (
              <li key={item.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  disabled={disabled}
                  aria-label={`${item.caption ?? "Photo"}${isSelected ? ` — ${L.selected}` : ""}`}
                  className={cn(
                    "relative aspect-square w-full overflow-hidden border transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isSelected
                      ? "border-foreground"
                      : "border-transparent hover:border-border focus-visible:border-border",
                    disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/50">
                      <span className="text-xs font-bold text-background">
                        {selectedIds.indexOf(item.id) + 1}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Upload dropzone */}
      <div>
        <div
          role="button"
          tabIndex={0}
          aria-label={dragOver ? L.dropZoneActive : L.dropZone}
          onDragOver={onDropzoneDragOver}
          onDragLeave={onDropzoneDragLeave}
          onDrop={onDropzoneDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          className={cn(
            "flex min-h-16 cursor-pointer items-center justify-center gap-2 border border-dashed p-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            dragOver
              ? "border-foreground bg-accent/30"
              : "border-border text-muted-foreground hover:bg-accent/20 focus-visible:bg-accent/20"
          )}
        >
          {uploading ? (
            <>
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              {L.uploading}
            </>
          ) : (
            <>
              <ImagePlusIcon className="size-4" aria-hidden />
              {dragOver ? L.dropZoneActive : L.uploadMore}
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
          tabIndex={-1}
        />
      </div>

      {uploadError && (
        <p role="alert" className="text-xs text-destructive">
          {uploadError}
        </p>
      )}
    </div>
  );
}
