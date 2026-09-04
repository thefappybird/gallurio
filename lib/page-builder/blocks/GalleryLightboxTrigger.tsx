"use client";

/**
 * Client island that wraps a gallery thumbnail so a click opens the shared
 * fullscreen Lightbox (same one used by the Featured Work / CollectionPopup
 * flow). GalleryGridBlock/GalleryMasonryBlock stay isomorphic (server-safe,
 * no hooks) — only this trigger needs interactivity.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Lightbox, type LightboxImage, type LightboxLabels } from "./Lightbox";
import type { ImageModalLayout } from "@/lib/page-builder/types";

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
          images={images ?? [image]}
          initialIndex={index ?? 0}
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
