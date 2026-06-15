"use client";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";
import type { PickerItem } from "./types";

export type CachedPage = { items: PickerItem[]; nextCursor: string | null };

interface GalleryPickerCache {
  /** Get cached pages for a collection (undefined = not cached). */
  getPages(collectionId: string): CachedPage[] | undefined;
  /** Append a fetched page to the cache for a collection. */
  addPage(collectionId: string, page: CachedPage): void;
  /** Invalidate one collection (or all if no argument). */
  bust(collectionId?: string): void;
}

const GalleryPickerCacheContext = createContext<GalleryPickerCache | null>(null);

export function GalleryPickerCacheProvider({ children }: { children: ReactNode }) {
  const cache = useRef<Map<string, CachedPage[]>>(new Map());

  const getPages = useCallback((id: string) => cache.current.get(id), []);

  const addPage = useCallback((id: string, page: CachedPage) => {
    const existing = cache.current.get(id) ?? [];
    cache.current.set(id, [...existing, page]);
  }, []);

  const bust = useCallback((id?: string) => {
    if (id === undefined) {
      cache.current.clear();
    } else {
      cache.current.delete(id);
    }
  }, []);

  return (
    <GalleryPickerCacheContext.Provider value={{ getPages, addPage, bust }}>
      {children}
    </GalleryPickerCacheContext.Provider>
  );
}

export function useGalleryPickerCache(): GalleryPickerCache | null {
  return useContext(GalleryPickerCacheContext);
}
