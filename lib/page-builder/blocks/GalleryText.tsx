/**
 * Shared heading/description/footer text for the gallery blocks (Grid, Masonry,
 * Carousel). Server-safe (no "use client"). Text is styled section-wide by the
 * block's `_style` toolkit; an empty value renders nothing so the block stays
 * clean by default.
 */

import { asText } from "@/lib/page-builder/styleToolkit";

export function GalleryHeader({
  heading,
  description,
  align = "center",
  overlay = false,
}: {
  heading?: string;
  description?: string;
  align?: "left" | "center" | "right";
  overlay?: boolean;
}) {
  const h = asText(heading);
  const d = asText(description);
  if (!h && !d) return null;

  const maxWidth = align === "center" ? "40rem" : "36rem";
  const paragraphMargin =
    align === "center" ? "0.5rem auto 0" : align === "right" ? "0.5rem 0 0 auto" : "0.5rem 0 0";
  const textColor = overlay ? "var(--pf-color-bg)" : "var(--pf-color-fg)";

  return (
    <div style={{ textAlign: align, marginBottom: "1.5rem" }}>
      {h && (
        <h2
          style={{
            fontFamily: "var(--pf-font-heading)",
            fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
            lineHeight: 1.2,
            color: textColor,
            margin: 0,
            textShadow: overlay ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {h}
        </h2>
      )}
      {d && (
        <p
          style={{
            fontFamily: "var(--pf-font-body)",
            fontSize: "1rem",
            lineHeight: 1.6,
            color: textColor,
            opacity: overlay ? 0.92 : 0.75,
            maxWidth,
            margin: paragraphMargin,
            whiteSpace: "pre-line",
            textShadow: overlay ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {d}
        </p>
      )}
    </div>
  );
}

export function GalleryFooter({ footer }: { footer?: string }) {
  const f = asText(footer);
  if (!f) return null;

  return (
    <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
      <p
        style={{
          fontFamily: "var(--pf-font-body)",
          fontSize: "0.9375rem",
          lineHeight: 1.6,
          color: "var(--pf-color-fg)",
          opacity: 0.75,
          maxWidth: "40rem",
          margin: "0 auto",
          whiteSpace: "pre-line",
        }}
      >
        {f}
      </p>
    </div>
  );
}
