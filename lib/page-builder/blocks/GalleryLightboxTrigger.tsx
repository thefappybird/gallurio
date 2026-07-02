"use client";

/**
 * Client island that wraps a gallery thumbnail so a click opens the shared
 * fullscreen Lightbox (same one used by the Featured Work / CollectionPopup
 * flow). GalleryGridBlock/GalleryMasonryBlock stay isomorphic (server-safe,
 * no hooks) — only this trigger needs interactivity.
 */

import { useState, type ReactNode } from "react";
import { Lightbox, type LightboxImage } from "./Lightbox";

export function GalleryLightboxTrigger({
  image,
  closeLabel,
  fullSizeAlt,
  children,
}: {
  image: LightboxImage;
  closeLabel?: string;
  fullSizeAlt?: string;
  children: ReactNode;
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
        }}
      >
        {children}
      </button>
      {open && (
        <Lightbox
          image={image}
          onClose={() => setOpen(false)}
          closeLabel={closeLabel}
          fullSizeAlt={fullSizeAlt}
        />
      )}
    </>
  );
}
