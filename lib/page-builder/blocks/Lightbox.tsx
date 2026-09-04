"use client";

import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";

// ---------------------------------------------------------------------------
// Shared fullscreen lightbox — used by CollectionPopup (Featured Work) and the
// Gallery grid/masonry blocks. Same image on the public page and the editor
// canvas (isomorphic, no server-only imports).
// ---------------------------------------------------------------------------

export type LightboxImage = {
  id: string;
  publicId: string;
  alt: string;
  title?: string;
  caption?: string;
  date?: string;
  location?: string;
  client?: string;
  meta?: { label: string; value: string }[];
  tags?: string[];
  width?: number;
  height?: number;
};

const FOCUS_VISIBLE_STYLES = `
[data-lightbox-close]:focus-visible {
  outline: 2px solid var(--pf-color-fg, #111);
  outline-offset: 2px;
}
`;

function FloatingCloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-lightbox-close=""
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        border: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 20%, transparent)",
        background: "var(--pf-color-bg, #fff)",
        color: "var(--pf-color-fg, #111)",
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--pf-color-fg, #111)";
        (e.currentTarget as HTMLButtonElement).style.color =
          "var(--pf-color-bg, #fff)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--pf-color-bg, #fff)";
        (e.currentTarget as HTMLButtonElement).style.color =
          "var(--pf-color-fg, #111)";
      }}
    >
      <XIcon aria-hidden style={{ width: "16px", height: "16px" }} />
    </button>
  );
}

export function Lightbox({
  image,
  onClose,
  closeLabel = "Close",
  fullSizeAlt = "Full size photo",
}: {
  image: LightboxImage;
  onClose: () => void;
  closeLabel?: string;
  fullSizeAlt?: string;
}) {
  const src = imageDeliveryUrl(image.publicId, { width: 2000, fit: "scale-down" });

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.85)",
          }}
        />
        <DialogPrimitive.Popup
          aria-label={image.alt || fullSizeAlt}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 201,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <style>{FOCUS_VISIBLE_STYLES}</style>
          <FloatingCloseButton onClick={onClose} label={closeLabel} />
          {src ? (
            <img
              src={src}
              alt={image.alt}
              style={{
                maxWidth: "95vw",
                maxHeight: "95vh",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                color: "#fff",
                padding: "2rem",
                textAlign: "center",
              }}
            >
              {image.alt || "Photo"}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
