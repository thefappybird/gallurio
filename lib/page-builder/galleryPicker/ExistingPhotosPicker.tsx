"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeftIcon, ImagePlusIcon, Loader2Icon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePickerData } from "./usePickerData";
import type { PickerCollection, PickerItem } from "./types";

const ALL_PHOTOS: PickerCollection = { id: "all", name: "All Photos", coverUrl: null, coverPublicId: "", itemCount: 0 };
const COLS_PER_PAGE = 8; // 4×2
const PHOTOS_LIMIT = 9; // 3×3

type FeedState = { items: PickerItem[]; nextCursor: string | null; loading: boolean; error: boolean };

export function ExistingPhotosPicker({
  open,
  onOpenChange,
  excludePublicIds = [],
  onAdd,
  title = "Select existing photos",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludePublicIds?: string[];
  onAdd: (items: PickerItem[]) => void;
  title?: string;
}) {
  const { state, retry } = usePickerData();
  const [activeCol, setActiveCol] = useState<PickerCollection | null>(null);
  const [colPage, setColPage] = useState(0);
  const [feed, setFeed] = useState<FeedState>({ items: [], nextCursor: null, loading: false, error: false });
  const [selected, setSelected] = useState<Record<string, PickerItem>>({});
  const excluded = useMemo(() => new Set(excludePublicIds), [excludePublicIds]);

  const pages = useMemo(() => {
    const collections = state.status === "ok" ? state.data.collections : [];
    const all = [ALL_PHOTOS, ...collections];
    const out: PickerCollection[][] = [];
    for (let i = 0; i < all.length; i += COLS_PER_PAGE) out.push(all.slice(i, i + COLS_PER_PAGE));
    return out.length ? out : [[ALL_PHOTOS]];
  }, [state]);
  const pageIndex = Math.min(colPage, pages.length - 1);

  const loadFeed = useCallback(async (col: PickerCollection, cursor: string | null) => {
    setFeed((f) => ({ ...f, loading: true, error: false }));
    try {
      const q = new URLSearchParams({ limit: String(PHOTOS_LIMIT) });
      if (cursor) q.set("cursor", cursor);
      const res = await fetch(`/api/portfolio/gallery/collections/${col.id}?${q.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null };
      setFeed((f) => ({
        items: cursor ? [...f.items, ...data.items] : data.items,
        nextCursor: data.nextCursor,
        loading: false,
        error: false,
      }));
    } catch {
      setFeed((f) => ({ ...f, loading: false, error: true }));
    }
  }, []);

  function openCollection(col: PickerCollection) {
    setActiveCol(col);
    setFeed({ items: [], nextCursor: null, loading: true, error: false });
    void loadFeed(col, null);
  }
  function toggle(item: PickerItem) {
    if (excluded.has(item.publicId)) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }
  const selectedList = Object.values(selected);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setActiveCol(null);
      setColPage(0);
      setSelected({});
      setFeed({ items: [], nextCursor: null, loading: false, error: false });
    }
    onOpenChange(next);
  }

  function confirmAdd() {
    if (selectedList.length === 0) return;
    onAdd(selectedList);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[70vh] sm:max-w-2xl">
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2">
            {activeCol && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to collections" onClick={() => setActiveCol(null)}>
                <ChevronLeftIcon className="size-4" aria-hidden />
              </Button>
            )}
            <DialogTitle className="truncate">{activeCol ? activeCol.name : title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {!activeCol ? (
            <CollectionsView
              loading={state.status === "loading"}
              error={state.status === "error"}
              page={pages[pageIndex] ?? []}
              pageIndex={pageIndex}
              pageCount={pages.length}
              onPrev={() => setColPage((p) => Math.max(0, p - 1))}
              onNext={() => setColPage((p) => Math.min(pages.length - 1, p + 1))}
              onOpenCol={openCollection}
              onRetry={retry}
            />
          ) : (
            <PhotosView
              feed={feed}
              excluded={excluded}
              isSelected={(id) => Boolean(selected[id])}
              onToggle={toggle}
              onLoadMore={() => activeCol && feed.nextCursor && void loadFeed(activeCol, feed.nextCursor)}
              onRetry={() => activeCol && void loadFeed(activeCol, null)}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="brand" disabled={selectedList.length === 0} onClick={confirmAdd}>
            {selectedList.length === 0 ? "Add photos" : `Add ${selectedList.length} photo${selectedList.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CenterSpinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden /> Loading…
    </div>
  );
}

function CollectionsView({
  loading, error, page, pageIndex, pageCount, onPrev, onNext, onOpenCol, onRetry,
}: {
  loading: boolean; error: boolean; page: PickerCollection[]; pageIndex: number; pageCount: number;
  onPrev: () => void; onNext: () => void; onOpenCol: (c: PickerCollection) => void; onRetry: () => void;
}) {
  if (loading) return <CenterSpinner />;
  if (error)
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm">
        <p className="text-destructive">Could not load your collections.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {page.map((col) => (
          <li key={col.id}>
            <button
              type="button"
              onClick={() => onOpenCol(col)}
              aria-label={col.name}
              className="flex w-full flex-col overflow-hidden border border-border text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
                {col.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={col.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
                )}
              </span>
              <span className="flex flex-col gap-0.5 px-2 py-1.5">
                <span className="truncate text-xs font-medium">{col.name}</span>
                {col.id !== "all" && <span className="text-xs text-muted-foreground">{col.itemCount} photos</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button type="button" variant="outline" size="sm" disabled={pageIndex === 0} onClick={onPrev}>Prev</Button>
          <span className="text-muted-foreground">{pageIndex + 1} / {pageCount}</span>
          <Button type="button" variant="outline" size="sm" disabled={pageIndex >= pageCount - 1} onClick={onNext}>Next</Button>
        </div>
      )}
    </div>
  );
}

function PhotosView({
  feed, excluded, isSelected, onToggle, onLoadMore, onRetry,
}: {
  feed: FeedState; excluded: Set<string>; isSelected: (id: string) => boolean;
  onToggle: (item: PickerItem) => void; onLoadMore: () => void; onRetry: () => void;
}) {
  if (feed.error)
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm">
        <p className="text-destructive">Could not load photos.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {feed.items.length === 0 && !feed.loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No photos here yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="Photos">
          {feed.items.map((item) => {
            const isExcluded = excluded.has(item.publicId);
            const selected = isSelected(item.id);
            return (
              <li key={item.id}>
                {/* The button itself is the option: keyboard-focusable, Enter/Space
                    activates onToggle, and a single handler avoids double-firing. */}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={isExcluded}
                  onClick={() => onToggle(item)}
                  aria-label={`${item.caption || "Photo"}${isExcluded ? " — already added" : selected ? " — selected" : ""}`}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isExcluded ? "cursor-not-allowed border-border opacity-40" : selected ? "border-foreground" : "border-border hover:bg-accent/40"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                  {selected && (
                    <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center bg-foreground text-xs font-bold text-background">✓</span>
                  )}
                  {isExcluded && (
                    <span className="absolute inset-x-0 bottom-0 bg-background/80 px-1 py-0.5 text-center text-[10px]">Added</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {feed.loading && <CenterSpinner />}
      {feed.nextCursor && !feed.loading && (
        <Button type="button" variant="outline" size="sm" className="self-center" onClick={onLoadMore}>Load more</Button>
      )}
    </div>
  );
}
