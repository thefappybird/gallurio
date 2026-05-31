"use client";

import { useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { uploadImageToCloudinary } from "@/lib/storage/uploadToCloudinary.client";
import { usePickerData } from "./usePickerData";
import type { PickerCollection } from "./types";

// Plain strings — Puck editor chrome is English (see RELEASE-CHECKLIST §4f).
const L = {
  title: "Photos & collections",
  intro:
    "Group your photos into collections. Use them in Gallery blocks, or pick any single photo as a Hero / CTA background. Add photos here once — pick them anywhere.",
  empty: "No collections yet. Create your first one below.",
  loading: "Loading…",
  error: "Could not load your collections.",
  retry: "Retry",
  newCollection: "New collection",
  nameLabel: "Collection title",
  namePlaceholder: "e.g. Weddings 2024",
  dropZone: "Drag photos here or click to select",
  dropZoneActive: "Drop to upload",
  hint: "JPEG, PNG, WebP or AVIF · max 10 MB · min 600 px",
  uploading: "Uploading…",
  create: "Create collection",
  creating: "Creating…",
  errType: "Only JPEG, PNG, WebP, and AVIF photos are accepted.",
  errSize: "Each photo must be under 10 MB.",
  errDim: "Photos must be at least 600px on the shorter side.",
  errUpload: "Some photos failed to upload.",
  errCreate: "Could not create the collection. Please try again.",
  removePhoto: "Remove photo",
  photos: "photos",
  done: "Done",
};

type LocalImage = {
  cloudinaryPublicId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
};

export function CollectionsManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, retry } = usePickerData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [images, setImages] = useState<LocalImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setImages([]);
    setError(null);
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const valid: File[] = [];
    let typeErr = false;
    let sizeErr = false;
    Array.from(files).forEach((f) => {
      const check = validatePhotoFile(f);
      if (!check.ok) {
        if (check.reason === "type_not_accepted") typeErr = true;
        else sizeErr = true;
      } else valid.push(f);
    });
    const topError = typeErr ? L.errType : sizeErr ? L.errSize : null;
    if (valid.length === 0) {
      if (topError) setError(topError);
      return;
    }
    setUploading(true);
    setError(topError);
    Promise.allSettled(
      valid.map((file) => uploadImageToCloudinary(file, { subfolder: "portfolio" }))
    ).then((results) => {
      const ok: LocalImage[] = [];
      let dimErr = false;
      for (const r of results) {
        if (r.status === "fulfilled") ok.push(r.value);
        else if ((r.reason instanceof Error ? r.reason.message : "") === "dimension_too_small") dimErr = true;
      }
      setImages((prev) => [...prev, ...ok]);
      setUploading(false);
      setError(dimErr ? L.errDim : ok.length === 0 ? L.errUpload : null);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function createCollection() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/gallery/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), items: images }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reset();
      retry(); // refresh the collections list
    } catch {
      setError(L.errCreate);
    } finally {
      setSaving(false);
    }
  }

  const collections: PickerCollection[] = state.status === "ok" ? state.data.collections : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{L.intro}</p>

          {/* Existing collections */}
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
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {collections.map((col) => (
                <li key={col.id} className="flex flex-col overflow-hidden border border-border">
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
                      {col.itemCount} {L.photos}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Create new collection */}
          <div className="flex flex-col gap-3 border border-border p-3">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <PlusIcon className="size-4" aria-hidden />
              {L.newCollection}
            </span>

            <label className="flex flex-col gap-1.5 text-sm">
              <span>{L.nameLabel}</span>
              <input
                type="text"
                value={name}
                placeholder={L.namePlaceholder}
                disabled={saving}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
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

            {images.length > 0 && (
              <ul className="grid grid-cols-4 gap-1.5" aria-label="Uploaded photos">
                {images.map((img, i) => (
                  <li
                    key={img.cloudinaryPublicId}
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
              </ul>
            )}

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <Button
              type="button"
              size="sm"
              onClick={createCollection}
              loading={saving}
              disabled={saving || uploading || !name.trim()}
              className="self-start"
            >
              {saving ? L.creating : L.create}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {L.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
