"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  GripVerticalIcon,
  ImagePlusIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { usePickerData } from "./usePickerData";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import { useGalleryPickerCache } from "./GalleryPickerCacheContext";
import type { PickerCollection, PickerItem } from "./types";

// Plain strings — the Puck field panel is not wrapped in an IntlProvider.
const L = {
  title: "Choose photos",
  titleSingle: "Choose a photo",
  titleCollections: "Choose collections",
  back: "Back to collections",
  allPhotos: "All photos",
  createCollection: "New collection",
  loading: "Loading…",
  loadMore: "Load more",
  error: "Could not load photos.",
  retry: "Retry",
  emptyWorkspace: "No photos yet — upload below.",
  emptyCollection: "This collection is empty — upload below.",
  selectAllPage: "Select all on page",
  selectAllCollection: "Select all in collection",
  clearAll: "Clear selection",
  done: "Done",
  photos: (n: number) => `${n} photo${n === 1 ? "" : "s"}`,
  selectedCount: (n: number, max?: number) => (max ? `${n}/${max} selected` : `${n} selected`),
  dragHint: "Drag to reorder",
  removePhoto: "Remove photo",
  removeCollection: "Remove collection",
  uploadHere: "Upload photo",
  uploading: "Uploading…",
  dropActive: "Drop to upload",
  errType: "Only JPEG, PNG, WebP, and AVIF photos are accepted.",
  errSize: "Each photo must be under 10 MB.",
  errDim: "Photos must be at least 600×600px — both width and height must be 600px or more.",
  errUpload: "Some photos failed to upload.",
};

const ALL_PHOTOS_ID = "all";
const PAGE_SIZE = 16;
const SAFETY_CAP = 60;

export type MediaPickerSelection = {
  id: string;
  publicId: string;
  /** Natural pixel width — present when the image was uploaded in this session. */
  width?: number;
  /** Natural pixel height — present when the image was uploaded in this session. */
  height?: number;
};
export type MediaPickerCollectionSelection = {
  id: string;
  name: string;
  coverPublicId: string;
  itemCount: number;
};
export type MediaPickerValue = string | MediaPickerSelection[] | MediaPickerCollectionSelection[];

type Props =
  | {
      mode: "single";
      /** single: publicId string (""=none). */
      value: string;
      onChange: (next: string) => void;
      max?: never;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }
  | {
      mode: "multi";
      /** multi: ordered [{id,publicId}]. */
      value: MediaPickerSelection[];
      onChange: (next: MediaPickerSelection[]) => void;
      /** hard cap on selections. */
      max?: number;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }
  | {
      mode: "collections";
      /** collections: ordered [{id,name,coverPublicId,itemCount}]. */
      value: MediaPickerCollectionSelection[];
      onChange: (next: MediaPickerCollectionSelection[]) => void;
      max?: number;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

type Nav = { kind: "collections" } | { kind: "photos"; id: string; name: string };

type FeedState = {
  items: PickerItem[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
};

const EMPTY_FEED: FeedState = { items: [], nextCursor: null, loading: false, error: false };

function asPhotoSelection(value: MediaPickerSelection[] | string): MediaPickerSelection[] {
  return Array.isArray(value) ? (value as MediaPickerSelection[]) : [];
}

function asCollectionSelection(value: MediaPickerCollectionSelection[]): MediaPickerCollectionSelection[] {
  return Array.isArray(value) ? value : [];
}

export function MediaPicker({ mode, value, onChange, max, open, onOpenChange }: Props) {
  const { state, retry } = usePickerData();
  const cache = useGalleryPickerCache();
  const [nav, setNav] = useState<Nav>({ kind: "collections" });
  const [feed, setFeed] = useState<FeedState>(EMPTY_FEED);
  const [createOpen, setCreateOpen] = useState(false);

  // Upload state (scoped to the open collection / all feed).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Monotonic token invalidating in-flight feed fetches when the view changes,
  // so a slow response from a prior collection cannot bleed into the current one.
  const fetchToken = useRef(0);

  // Accumulated id->item map so the multi reorder strip can resolve thumbnails
  // for selections regardless of which page/collection they came from.
  const seen = useRef<Map<string, PickerItem>>(new Map());
  const remember = useCallback((items: PickerItem[]) => {
    for (const it of items) seen.current.set(it.id, it);
  }, []);

  // Derive typed selections based on mode.
  const selection = mode === "multi" ? asPhotoSelection(value as MediaPickerSelection[]) : [];
  const collectionSelection = mode === "collections" ? asCollectionSelection(value as MediaPickerCollectionSelection[]) : [];

  // Reset navigation each time the modal opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs the `open` prop (external state) back to a fresh collections view on each open
      setNav({ kind: "collections" });
      setFeed(EMPTY_FEED);
      setUploadError(null);
      fetchToken.current++; // invalidate any in-flight feed fetch from a prior open
    }
  }, [open]);

  // Seed the seen-map from picker data so existing selections resolve.
  useEffect(() => {
    if (state.status === "ok") remember(state.data.items);
  }, [state, remember]);

  const fetchFeed = useCallback(
    async (id: string, cursor: string | null) => {
      // First page: serve from session cache if available (avoids a redundant
      // network round-trip when the user re-opens a collection they already browsed).
      if (cursor === null) {
        const cached = cache?.getPages(id);
        if (cached && cached.length > 0) {
          const allItems = cached.flatMap((p) => p.items);
          const lastCursor = cached[cached.length - 1].nextCursor;
          remember(allItems);
          setFeed({ items: allItems, nextCursor: lastCursor, loading: false, error: false });
          return;
        }
      }

      const token = ++fetchToken.current;
      setFeed((f) => ({ ...f, loading: true, error: false }));
      try {
        const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) qs.set("cursor", cursor);
        const res = await fetch(`/api/portfolio/gallery/collections/${id}?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null };
        remember(data.items);
        cache?.addPage(id, { items: data.items, nextCursor: data.nextCursor });
        if (token !== fetchToken.current) return; // stale: a newer view superseded this fetch
        setFeed((f) => ({
          items: cursor ? [...f.items, ...data.items] : data.items,
          nextCursor: data.nextCursor,
          loading: false,
          error: false,
        }));
      } catch {
        if (token !== fetchToken.current) return; // stale: do not flag the current view as errored
        setFeed((f) => ({ ...f, loading: false, error: true }));
      }
    },
    [cache, remember]
  );

  function openCollection(id: string, name: string) {
    fetchToken.current++; // invalidate any in-flight fetch from the prior view
    setNav({ kind: "photos", id, name });
    setFeed(EMPTY_FEED);
    setUploadError(null);
    void fetchFeed(id, null);
  }

  function goBack() {
    fetchToken.current++; // invalidate any in-flight fetch from the collection we left
    setNav({ kind: "collections" });
    setFeed(EMPTY_FEED);
  }

  // -------------------------------------------------------------------------
  // Selection — single / multi (photos)
  // -------------------------------------------------------------------------

  function pickSingle(item: PickerItem) {
    if (mode !== "single") return;
    onChange(item.publicId);
    onOpenChange(false);
  }

  function toggleMulti(item: PickerItem) {
    if (mode !== "multi") return;
    const exists = selection.some((s) => s.id === item.id);
    if (exists) {
      onChange(selection.filter((s) => s.id !== item.id));
      return;
    }
    if (max != null && selection.length >= max) return;
    onChange([
      ...selection,
      {
        id: item.id,
        publicId: item.publicId,
        ...(item.width != null && item.height != null
          ? { width: item.width, height: item.height }
          : {}),
      },
    ]);
  }

  function selectAllOnPage() {
    if (mode !== "multi") return;
    const cap = max ?? SAFETY_CAP;
    const next = [...selection];
    for (const it of feed.items) {
      if (next.length >= cap) break;
      if (!next.some((s) => s.id === it.id))
        next.push({
          id: it.id,
          publicId: it.publicId,
          ...(it.width != null && it.height != null
            ? { width: it.width, height: it.height }
            : {}),
        });
    }
    onChange(next);
  }

  // "Select all in collection" — the newest `cap` items across ALL pages,
  // fetched server-side (newest-first). Display order stays collection-`order`;
  // bulk-select is intentionally newest-first (owner wants the latest N).
  const [bulkLoading, setBulkLoading] = useState(false);
  async function selectAllInCollection() {
    if (mode !== "multi") return;
    if (nav.kind !== "photos" || nav.id === ALL_PHOTOS_ID) return;
    const cap = max ?? SAFETY_CAP;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${nav.id}?newest=${cap}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PickerItem[] };
      remember(data.items);
      onChange(data.items.slice(0, cap).map((it) => ({ id: it.id, publicId: it.publicId })));
    } catch {
      // Non-fatal: leave the current selection untouched.
    } finally {
      setBulkLoading(false);
    }
  }

  function clearSelection() {
    if (mode === "multi") onChange([]);
    else if (mode === "collections") onChange([]);
  }

  function reorder(fromId: string, toId: string) {
    if (mode !== "multi") return;
    if (fromId === toId) return;
    const copy = [...selection];
    const fi = copy.findIndex((s) => s.id === fromId);
    const ti = copy.findIndex((s) => s.id === toId);
    if (fi === -1 || ti === -1) return;
    const [moved] = copy.splice(fi, 1);
    copy.splice(ti, 0, moved);
    onChange(copy);
  }

  // -------------------------------------------------------------------------
  // Selection — collections mode
  // -------------------------------------------------------------------------

  function toggleCollection(col: PickerCollection) {
    if (mode !== "collections") return;
    const exists = collectionSelection.some((s) => s.id === col.id);
    if (exists) {
      onChange(collectionSelection.filter((s) => s.id !== col.id));
      return;
    }
    const cap = max ?? SAFETY_CAP;
    if (collectionSelection.length >= cap) return;
    onChange([
      ...collectionSelection,
      { id: col.id, name: col.name, coverPublicId: col.coverPublicId, itemCount: col.itemCount },
    ]);
  }

  function reorderCollections(fromId: string, toId: string) {
    if (mode !== "collections") return;
    if (fromId === toId) return;
    const copy = [...collectionSelection];
    const fi = copy.findIndex((s) => s.id === fromId);
    const ti = copy.findIndex((s) => s.id === toId);
    if (fi === -1 || ti === -1) return;
    const [moved] = copy.splice(fi, 1);
    copy.splice(ti, 0, moved);
    onChange(copy);
  }

  // -------------------------------------------------------------------------
  // Upload (into the open collection, or standalone when on "All photos")
  // -------------------------------------------------------------------------

  async function handleFiles(files: FileList | null) {
    if (!files || nav.kind !== "photos") return;
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
    if (valid.length === 0) {
      setUploadError(typeErr ? L.errType : sizeErr ? L.errSize : null);
      return;
    }

    // Capture the current view's token so a slow upload that finishes after the
    // owner navigates away does not prepend the new item into the wrong feed.
    const token = fetchToken.current;
    setUploading(true);
    setUploadError(null);
    const results = await Promise.allSettled(
      valid.map((file) => uploadImage(file, { subfolder: "portfolio" }))
    );

    let dimErr = false;
    let generalErr = false;
    const targetCollection = nav.id === ALL_PHOTOS_ID ? undefined : nav.id;

    for (const r of results) {
      if (r.status === "rejected") {
        if ((r.reason instanceof Error ? r.reason.message : "") === "dimension_too_small") dimErr = true;
        else generalErr = true;
        continue;
      }
      try {
        const createRes = await fetch("/api/portfolio/gallery/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...r.value, collectionId: targetCollection }),
        });
        if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);
        const created = (await createRes.json()) as { id: string; thumbUrl: string; caption: string | null };
        const item: PickerItem = {
          id: created.id,
          publicId: r.value.assetId,
          thumbUrl: created.thumbUrl,
          caption: created.caption,
          // uploadImage already measured naturalWidth/Height before the upload;
          // propagate them so a freshly-uploaded image carries dims into any
          // subsequent selection, enabling the block to reserve space (CLS fix).
          ...(r.value.width != null && r.value.height != null
            ? { width: r.value.width, height: r.value.height }
            : {}),
        };
        remember([item]);
        if (token === fetchToken.current) {
          setFeed((f) => ({ ...f, items: [item, ...f.items] }));
        }
      } catch {
        generalErr = true;
      }
    }

    setUploading(false);
    if (dimErr) setUploadError(L.errDim);
    else if (generalErr) setUploadError(L.errUpload);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Bust the cache for the affected collection so re-opening it fetches fresh data.
    if (targetCollection) {
      cache?.bust(targetCollection);
    } else {
      cache?.bust(ALL_PHOTOS_ID);
    }
    retry(); // refresh collection covers/counts
  }

  // -------------------------------------------------------------------------
  // Derived render data
  // -------------------------------------------------------------------------

  const collections: PickerCollection[] = state.status === "ok" ? state.data.collections : [];
  const isSelected = (id: string) =>
    mode === "single" ? false : selection.some((s) => s.id === id);
  const orderOf = (id: string) => selection.findIndex((s) => s.id === id) + 1;

  const isCollectionSelected = (id: string) =>
    mode === "collections" ? collectionSelection.some((s) => s.id === id) : false;
  const collectionOrderOf = (id: string) =>
    collectionSelection.findIndex((s) => s.id === id) + 1;

  const selectionItems = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- intentional: the seen-map is a write-only accumulator of resolved thumbnails; recomputation is driven by `selection`, and a missing entry renders a placeholder
      selection.map((s) => ({
        ...s,
        item: seen.current.get(s.id) ?? null,
      })),
    [selection]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[80vh] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {nav.kind === "photos" && (
              <button
                type="button"
                onClick={goBack}
                aria-label={L.back}
                className="inline-flex size-7 items-center justify-center border border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeftIcon className="size-4" aria-hidden />
              </button>
            )}
            <DialogTitle>
              {nav.kind === "photos"
                ? nav.name
                : mode === "single"
                  ? L.titleSingle
                  : mode === "collections"
                    ? L.titleCollections
                    : L.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Multi (photos) reorder strip */}
        {mode === "multi" && selection.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              {L.selectedCount(selection.length, max)} · {L.dragHint}
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Selected photos (drag to reorder)">
              {selectionItems.map(({ id, item }) => (
                <ReorderChip
                  key={id}
                  id={id}
                  item={item}
                  removeLabel={L.removePhoto}
                  onReorder={reorder}
                  onRemove={() => onChange(selection.filter((s) => s.id !== id))}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Collections mode reorder strip */}
        {mode === "collections" && collectionSelection.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              {L.selectedCount(collectionSelection.length, max)} · {L.dragHint}
            </p>
            <ul className="flex flex-wrap gap-2" role="listbox" aria-multiselectable="true" aria-label="Selected collections (drag to reorder)">
              {collectionSelection.map((s) => {
                const col = collections.find((c) => c.id === s.id);
                return (
                  <CollectionReorderChip
                    key={s.id}
                    id={s.id}
                    name={s.name}
                    coverUrl={col?.coverUrl ?? null}
                    onReorder={reorderCollections}
                    onRemove={() => onChange(collectionSelection.filter((c) => c.id !== s.id))}
                  />
                );
              })}
            </ul>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {state.status === "loading" && <CenterSpinner label={L.loading} />}
          {state.status === "error" && <ErrorRetry onRetry={retry} />}

          {state.status === "ok" && nav.kind === "collections" && mode !== "collections" && (
            <CollectionGrid
              collections={collections}
              hasAnyPhotos={state.data.items.length > 0 || collections.some((c) => c.itemCount > 0)}
              onOpen={openCollection}
              onCreate={() => setCreateOpen(true)}
            />
          )}

          {state.status === "ok" && nav.kind === "collections" && mode === "collections" && (
            <CollectionSelectGrid
              collections={collections}
              isSelected={isCollectionSelected}
              orderOf={collectionOrderOf}
              onToggle={toggleCollection}
              onCreate={() => setCreateOpen(true)}
            />
          )}

          {state.status === "ok" && nav.kind === "photos" && (
            <PhotoGrid
              feed={feed}
              mode={mode as "single" | "multi"}
              isSelected={isSelected}
              orderOf={orderOf}
              onPickSingle={pickSingle}
              onToggleMulti={toggleMulti}
              onLoadMore={() => nav.kind === "photos" && feed.nextCursor && fetchFeed(nav.id, feed.nextCursor)}
              onRetry={() => nav.kind === "photos" && fetchFeed(nav.id, null)}
              emptyLabel={nav.id === ALL_PHOTOS_ID ? L.emptyWorkspace : L.emptyCollection}
              uploadSlot={
                <UploadZone
                  uploading={uploading}
                  error={uploadError}
                  inputRef={fileInputRef}
                  onFiles={handleFiles}
                />
              }
            />
          )}
        </div>

        {/* Bulk actions + footer */}
        <DialogFooter className="items-center sm:justify-between">
          {mode === "multi" && nav.kind === "photos" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllOnPage} disabled={feed.items.length === 0}>
                {L.selectAllPage}
              </Button>
              {nav.id !== ALL_PHOTOS_ID && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllInCollection}
                  loading={bulkLoading}
                  disabled={bulkLoading || feed.items.length === 0}
                >
                  {L.selectAllCollection}
                </Button>
              )}
              {selection.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  {L.clearAll}
                </Button>
              )}
            </div>
          ) : (
            <span />
          )}
          {(mode === "multi" || mode === "collections") && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              {L.done}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          cache?.bust(); // invalidate all cached pages so the new collection appears
          retry();
        }}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10">
      <p className="text-sm text-destructive">{L.error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {L.retry}
      </button>
    </div>
  );
}

function CollectionGrid({
  collections,
  hasAnyPhotos,
  onOpen,
  onCreate,
}: {
  collections: PickerCollection[];
  hasAnyPhotos: boolean;
  onOpen: (id: string, name: string) => void;
  onCreate: () => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 p-1 sm:grid-cols-4" role="listbox" aria-label="Collections">
      {/* Virtual 'All photos', pinned first */}
      <li role="option" aria-selected={false}>
        <button
          type="button"
          onClick={() => onOpen(ALL_PHOTOS_ID, L.allPhotos)}
          className="flex w-full flex-col overflow-hidden border border-border text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="flex aspect-square w-full items-center justify-center bg-muted">
            <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <span className="px-2 py-1.5 text-xs font-medium">{L.allPhotos}</span>
        </button>
      </li>

      {collections.map((col) => (
        <li key={col.id} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onOpen(col.id, col.name)}
            aria-label={col.name}
            className="flex w-full flex-col overflow-hidden border border-border text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <span className="text-xs text-muted-foreground">{L.photos(col.itemCount)}</span>
            </span>
          </button>
        </li>
      ))}

      {/* Create collection */}
      <li>
        <button
          type="button"
          onClick={onCreate}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 border border-dashed border-border text-xs text-muted-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <PlusIcon className="size-5" aria-hidden />
          {L.createCollection}
        </button>
      </li>

      {!hasAnyPhotos && (
        <li className="col-span-full py-4 text-center text-sm text-muted-foreground">{L.emptyWorkspace}</li>
      )}
    </ul>
  );
}

function PhotoGrid({
  feed,
  mode,
  isSelected,
  orderOf,
  onPickSingle,
  onToggleMulti,
  onLoadMore,
  onRetry,
  emptyLabel,
  uploadSlot,
}: {
  feed: FeedState;
  mode: "single" | "multi";
  isSelected: (id: string) => boolean;
  orderOf: (id: string) => number;
  onPickSingle: (item: PickerItem) => void;
  onToggleMulti: (item: PickerItem) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  emptyLabel: string;
  uploadSlot: React.ReactNode;
}) {
  if (feed.error) return <ErrorRetry onRetry={onRetry} />;

  return (
    <div className="flex flex-col gap-3 p-1">
      {feed.items.length === 0 && !feed.loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="listbox" aria-label="Photos">
          {feed.items.map((item) => {
            const selected = isSelected(item.id);
            return (
              <li key={item.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => (mode === "single" ? onPickSingle(item) : onToggleMulti(item))}
                  aria-label={`${item.caption || "Photo"}${selected ? " — selected" : ""}`}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected ? "border-foreground" : "border-border hover:bg-accent/40"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                  {selected && (
                    <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center bg-foreground text-xs font-bold text-background">
                      {mode === "multi" ? orderOf(item.id) : "✓"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {feed.loading && <CenterSpinner label={L.loading} />}

      {feed.nextCursor && !feed.loading && (
        <Button type="button" variant="outline" size="sm" className="self-center" onClick={onLoadMore}>
          {L.loadMore}
        </Button>
      )}

      {uploadSlot}
    </div>
  );
}

function UploadZone({
  uploading,
  error,
  inputRef,
  onFiles,
}: {
  uploading: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={dragOver ? L.dropActive : L.uploadHere}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex min-h-14 cursor-pointer items-center justify-center gap-2 border border-dashed p-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          dragOver ? "border-foreground bg-accent/30" : "border-border text-muted-foreground hover:bg-accent/20"
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
            {dragOver ? L.dropActive : L.uploadHere}
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ReorderChip({
  id,
  item,
  removeLabel,
  onReorder,
  onRemove,
}: {
  id: string;
  item: PickerItem | null;
  removeLabel: string;
  onReorder: (fromId: string, toId: string) => void;
  onRemove: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData("text/plain");
        if (from) onReorder(from, id);
      }}
      className="relative aspect-square w-16 shrink-0 overflow-hidden border border-border"
    >
      {item ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">?</span>
      )}
      <span aria-hidden className="absolute left-0.5 top-0.5 flex size-5 items-center justify-center bg-background/80">
        <GripVerticalIcon className="size-3.5 text-muted-foreground" />
      </span>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </li>
  );
}

function CollectionReorderChip({
  id,
  name,
  coverUrl,
  onReorder,
  onRemove,
}: {
  id: string;
  name: string;
  coverUrl: string | null;
  onReorder: (fromId: string, toId: string) => void;
  onRemove: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected
      aria-label={name}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData("text/plain");
        if (from) onReorder(from, id);
      }}
      className="relative aspect-square w-16 shrink-0 overflow-hidden border border-foreground"
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">
          <ImagePlusIcon className="size-4" aria-hidden />
        </span>
      )}
      {/* Visible drag affordance */}
      <span aria-hidden className="absolute left-0.5 top-0.5 flex size-5 items-center justify-center bg-background/80">
        <GripVerticalIcon className="size-3.5 text-muted-foreground" />
      </span>
      <button
        type="button"
        aria-label={`${L.removeCollection} ${name}`}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </li>
  );
}

function CollectionSelectGrid({
  collections,
  isSelected,
  orderOf,
  onToggle,
  onCreate,
}: {
  collections: PickerCollection[];
  isSelected: (id: string) => boolean;
  orderOf: (id: string) => number;
  onToggle: (col: PickerCollection) => void;
  onCreate: () => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 p-1 sm:grid-cols-4" role="listbox" aria-label="Collections" aria-multiselectable="true">
      {collections.map((col) => {
        const selected = isSelected(col.id);
        const order = orderOf(col.id);
        return (
          <li key={col.id} role="option" aria-selected={selected}>
            <button
              type="button"
              onClick={() => onToggle(col)}
              aria-label={`${col.name}${selected ? ` — selected ${order}` : ""}`}
              className={cn(
                "flex w-full flex-col overflow-hidden border text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected ? "border-foreground" : "border-border hover:bg-accent/40"
              )}
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
                {selected && (
                  <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center bg-foreground text-xs font-bold text-background">
                    {order}
                  </span>
                )}
              </span>
              <span className="flex flex-col gap-0.5 px-2 py-1.5">
                <span className="truncate text-xs font-medium">{col.name}</span>
                <span className="text-xs text-muted-foreground">{L.photos(col.itemCount)}</span>
              </span>
            </button>
          </li>
        );
      })}

      {/* Create collection */}
      <li>
        <button
          type="button"
          onClick={onCreate}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 border border-dashed border-border text-xs text-muted-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <PlusIcon className="size-5" aria-hidden />
          {L.createCollection}
        </button>
      </li>

      {collections.length === 0 && (
        <li className="col-span-full py-4 text-center text-sm text-muted-foreground">{L.emptyWorkspace}</li>
      )}
    </ul>
  );
}
