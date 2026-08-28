"use client";

import { useMemo, useState } from "react";
import { ImageIcon, ImagePlusIcon, XIcon } from "lucide-react";
import { usePickerData } from "./usePickerData";
import { MediaPicker, type MediaPickerSelection, type MediaPickerCollectionSelection } from "./MediaPicker";
import type { PickerItem } from "./types";

// ---------------------------------------------------------------------------
// FeaturedCollectionRef — mirrors the block type but defined here to avoid a
// circular import (MediaField ← block type ← editorConfig ← MediaField).
// ---------------------------------------------------------------------------

export type CollectionRef = {
  id: string;
  name: string;
  coverPublicId: string;
  itemCount: number;
};

const L = {
  choosePhoto: "Choose photo",
  changePhoto: "Change photo",
  choosePhotos: "Choose photos",
  clear: "Clear",
  none: "No photo selected",
  selected: "Photo selected",
  count: (n: number) => `${n} photo${n === 1 ? "" : "s"} selected`,
};

/** Resolves a thumbUrl for a publicId/id from the cached picker items, if loaded. */
export function useThumbLookup() {
  const { state } = usePickerData();
  return useMemo(() => {
    const byPublicId = new Map<string, PickerItem>();
    const byId = new Map<string, PickerItem>();
    if (state.status === "ok") {
      for (const it of state.data.items) {
        byPublicId.set(it.publicId, it);
        byId.set(it.id, it);
      }
    }
    return { byPublicId, byId };
  }, [state]);
}

export function SingleImageControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const { byPublicId } = useThumbLookup();
  const thumb = value ? byPublicId.get(value)?.thumbUrl ?? null : null;

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-14 shrink-0 overflow-hidden border border-border bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">{value ? L.selected : L.none}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ImagePlusIcon className="size-3.5" aria-hidden />
            {value ? L.changePhoto : L.choosePhoto}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              <XIcon className="size-3" aria-hidden />
              {L.clear}
            </button>
          )}
        </div>
      </div>

      <MediaPicker
        mode="single"
        value={value}
        onChange={(v) => onChange(v as string)}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

export function MultiImageControl({
  value,
  onChange,
  max,
}: {
  value: MediaPickerSelection[];
  onChange: (v: MediaPickerSelection[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const { byId } = useThumbLookup();
  const selection = Array.isArray(value) ? value : [];

  return (
    <div className="flex flex-col gap-2">
      {selection.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected photos">
          {selection.slice(0, 6).map((s) => {
            const thumb = byId.get(s.id)?.thumbUrl ?? null;
            return (
              <li key={s.id} className="size-10 overflow-hidden border border-border bg-muted">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{L.count(selection.length)}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ImagePlusIcon className="size-3.5" aria-hidden />
          {L.choosePhotos}
        </button>
      </div>

      <MediaPicker
        mode="multi"
        max={max}
        value={selection}
        onChange={(v) => onChange(v as MediaPickerSelection[])}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MultiCollectionControl — collections-mode picker for FeaturedWork
// SingleCollectionControl — collections-mode picker for CollectionCard
// ---------------------------------------------------------------------------

/** Maps the picker's raw collection selection to the block-facing CollectionRef shape. */
function toCollectionRefs(selection: MediaPickerCollectionSelection[]): CollectionRef[] {
  return selection.map(
    (c): CollectionRef => ({
      id: c.id,
      name: c.name,
      coverPublicId: c.coverPublicId,
      itemCount: c.itemCount,
    })
  );
}

export function MultiCollectionControl({
  value,
  onChange,
}: {
  value: CollectionRef[];
  onChange: (v: CollectionRef[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selection = Array.isArray(value) ? value : [];

  function handleChange(next: unknown) {
    onChange(toCollectionRefs(next as MediaPickerCollectionSelection[]));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {selection.length === 0
            ? "No collections selected"
            : `${selection.length} collection${selection.length === 1 ? "" : "s"} selected`}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ImagePlusIcon className="size-3.5" aria-hidden />
          Choose collections
        </button>
      </div>

      <MediaPicker
        mode="collections"
        value={selection as MediaPickerCollectionSelection[]}
        onChange={handleChange}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

export function SingleCollectionControl({
  value,
  onChange,
}: {
  value: CollectionRef | undefined;
  onChange: (v: CollectionRef | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const selection = value ? [value] : [];

  function handleChange(next: unknown) {
    // Take the first entry; an empty selection clears to undefined.
    const cols = toCollectionRefs(next as MediaPickerCollectionSelection[]);
    onChange(cols[0]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {value ? value.name : "No collection selected"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ImagePlusIcon className="size-3.5" aria-hidden />
            {value ? "Change collection" : "Choose collection"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              <XIcon className="size-3" aria-hidden />
              {L.clear}
            </button>
          )}
        </div>
      </div>

      <MediaPicker
        mode="collections"
        max={1}
        value={selection as MediaPickerCollectionSelection[]}
        onChange={handleChange}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
