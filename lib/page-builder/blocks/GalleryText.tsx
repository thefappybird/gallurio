/**
 * Shared heading/description/footer text for the gallery blocks (Grid, Masonry,
 * Carousel). Server-safe (no "use client"). Each text is a styleable RichText
 * value; an empty value renders nothing so the block stays clean by default.
 */

import { renderRichText, type RichTextProp } from "@/lib/page-builder/styleToolkit";

export function GalleryHeader({
  heading,
  description,
}: {
  heading?: RichTextProp;
  description?: RichTextProp;
}) {
  const h = renderRichText(heading);
  const d = renderRichText(description);
  if (!h.text && !d.text) return null;

  return (
    <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
      {h.text && (
        <h2
          style={{
            fontFamily: "var(--pf-font-heading)",
            fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
            lineHeight: 1.2,
            color: "var(--pf-color-fg)",
            margin: 0,
            ...h.css,
          }}
        >
          {h.text}
        </h2>
      )}
      {d.text && (
        <p
          style={{
            fontFamily: "var(--pf-font-body)",
            fontSize: "1rem",
            lineHeight: 1.6,
            color: "var(--pf-color-fg)",
            opacity: 0.75,
            maxWidth: "40rem",
            margin: "0.5rem auto 0",
            whiteSpace: "pre-line",
            ...d.css,
          }}
        >
          {d.text}
        </p>
      )}
    </div>
  );
}

export function GalleryFooter({ footer }: { footer?: RichTextProp }) {
  const f = renderRichText(footer);
  if (!f.text) return null;

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
          ...f.css,
        }}
      >
        {f.text}
      </p>
    </div>
  );
}
