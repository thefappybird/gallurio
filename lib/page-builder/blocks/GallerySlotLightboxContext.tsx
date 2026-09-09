"use client";

/**
 * Item 11 — "images inside THAT block only" nav registry.
 *
 * GalleryGridBlock / GalleryMasonryBlock's new composition path renders its
 * Image children through a Puck Slot (a bare render function — see the type
 * `SlotComponent` in @measured/puck), so the parent block has no way to read
 * each child's picked photo ahead of render. Instead, GalleryGridBlock and
 * GalleryMasonryBlock wrap their slot output in <GallerySlotLightboxProvider>;
 * every ImageBlock inside self-registers via GalleryLightboxTrigger (which
 * consumes this context automatically whenever it's rendered without an
 * explicit `images` prop — see GalleryLightboxTrigger.tsx), so opening one
 * image pages through every OTHER image inside the same gallery block.
 *
 * A standalone Image block has no ancestor provider, so this hook returns
 * `null` there and the trigger keeps today's single-photo, no-nav behavior —
 * no branching needed at that call site.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LightboxImage } from "./Lightbox";

export type GallerySlotLightboxContextValue = {
  /** Every currently-mounted sibling image, in slot mount order. */
  images: LightboxImage[];
  register: (id: string, image: LightboxImage) => void;
  unregister: (id: string) => void;
};

const GallerySlotLightboxContext = createContext<GallerySlotLightboxContextValue | null>(null);

function sameImage(a: LightboxImage, b: LightboxImage): boolean {
  return (
    a.publicId === b.publicId &&
    a.alt === b.alt &&
    a.title === b.title &&
    a.caption === b.caption &&
    a.date === b.date &&
    a.location === b.location &&
    a.client === b.client &&
    a.width === b.width &&
    a.height === b.height &&
    JSON.stringify(a.meta) === JSON.stringify(b.meta) &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags)
  );
}

export function GallerySlotLightboxProvider({ children }: { children: ReactNode }) {
  // Mount order lives in state (not a ref, which render must never read from —
  // see react-hooks/refs) alongside the image data itself.
  const [order, setOrder] = useState<string[]>([]);
  const [entries, setEntries] = useState<Map<string, LightboxImage>>(() => new Map());

  const register = useCallback((id: string, image: LightboxImage) => {
    setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setEntries((prev) => {
      const existing = prev.get(id);
      if (existing && sameImage(existing, image)) return prev;
      const next = new Map(prev);
      next.set(id, image);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
    setEntries((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const images = useMemo(
    () => order.filter((id) => entries.has(id)).map((id) => entries.get(id) as LightboxImage),
    [order, entries]
  );

  const value = useMemo<GallerySlotLightboxContextValue>(
    () => ({ images, register, unregister }),
    [images, register, unregister]
  );

  return <GallerySlotLightboxContext.Provider value={value}>{children}</GallerySlotLightboxContext.Provider>;
}

/** `null` outside a <GallerySlotLightboxProvider> — see the module comment. */
export function useGallerySlotLightboxContext(): GallerySlotLightboxContextValue | null {
  return useContext(GallerySlotLightboxContext);
}
