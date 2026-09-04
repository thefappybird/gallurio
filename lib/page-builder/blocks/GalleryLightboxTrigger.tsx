"use client";

/**
 * Client island that wraps a gallery thumbnail so a click opens the shared
 * fullscreen Lightbox (same one used by the Featured Work / CollectionPopup
 * flow). GalleryGridBlock/GalleryMasonryBlock stay isomorphic (server-safe,
 * no hooks) — only this trigger needs interactivity.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Lightbox, type LightboxImage, type LightboxLabels } from "./Lightbox";
import type { ImageModalLayout } from "@/lib/page-builder/types";
import { useGallerySlotLightboxContext } from "./GallerySlotLightboxContext";

export function GalleryLightboxTrigger({
  image,
  images,
  index,
  total,
  hasMore,
  onRequestMore,
  layout,
  closeLabel,
  fullSizeAlt,
  labels,
  brandVars,
  children,
  buttonStyle,
}: {
  image: LightboxImage;
  /** Full loaded set for prev/next navigation. Defaults to `[image]` (no nav) when omitted. */
  images?: LightboxImage[];
  /** `image`'s position within `images`. Defaults to 0. */
  index?: number;
  total?: number;
  hasMore?: boolean;
  onRequestMore?: () => Promise<void> | void;
  layout?: ImageModalLayout;
  closeLabel?: string;
  fullSizeAlt?: string;
  /** Localized prev/next/counter/filmstrip copy — see Lightbox's LightboxLabels. */
  labels?: LightboxLabels;
  /** Forwarded straight to Lightbox — see the comment there for why it's
   *  needed. Typically `puck.metadata.workspace.brandVars`. */
  brandVars?: Record<string, string>;
  children: ReactNode;
  /** Merged onto the trigger button's base style — e.g. absolute-fill it when
   *  its picture is itself absolutely positioned inside the caller's frame. */
  buttonStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  // Item 11: when the caller doesn't already supply the full sibling set
  // (the single-image ImageBlock call shape), fall back to whatever gallery
  // block registry is in scope — see GallerySlotLightboxContext. An explicit
  // `images` prop (GalleryGrid/GalleryMasonry's legacy array render) always
  // wins; a standalone Image block has no provider ancestor, so `slotCtx` is
  // null there and behavior is unchanged (single photo, no nav).
  const slotCtx = useGallerySlotLightboxContext();
  const useSlotNav = !images && slotCtx !== null;

  // Depend on register/unregister (stable per Provider — see useCallback([])
  // there), NOT the `slotCtx` value object itself: that object's identity
  // changes every time ANY sibling (de)registers, and re-running THIS effect
  // on every sibling's change would unregister+re-register every other
  // sibling in a cascade — an actual render-thrashing loop, not just wasted
  // work, since each re-registration triggers the next.
  const register = slotCtx?.register;
  const unregister = slotCtx?.unregister;
  useEffect(() => {
    if (!useSlotNav || !register || !unregister) return;
    register(image.id, image);
    return () => unregister(image.id);
    // image's own fields are the real dependency, not its object identity —
    // callers rebuild this object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useSlotNav,
    register,
    unregister,
    image.id,
    image.publicId,
    image.alt,
    image.title,
    image.caption,
    image.date,
    image.location,
    image.client,
    image.width,
    image.height,
  ]);

  const slotImages = useSlotNav ? slotCtx?.images : undefined;
  const effectiveImages = images ?? slotImages;
  const effectiveIndex = images
    ? index
    : slotImages
      ? Math.max(0, slotImages.findIndex((img) => img.id === image.id))
      : index;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={image.alt || "Open photo"}
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          ...buttonStyle,
        }}
      >
        {children}
      </button>
      {open && (
        <Lightbox
          images={effectiveImages ?? [image]}
          initialIndex={effectiveIndex ?? 0}
          total={total}
          hasMore={hasMore}
          onRequestMore={onRequestMore}
          layout={layout}
          onClose={() => setOpen(false)}
          closeLabel={closeLabel}
          fullSizeAlt={fullSizeAlt}
          labels={labels}
          brandVars={brandVars}
        />
      )}
    </>
  );
}
