/**
 * Shared heading/description/footer text for the gallery blocks (Grid, Masonry,
 * Carousel). Server-safe (no "use client"). Text is styled section-wide by the
 * block's `_style` toolkit; an empty value renders nothing so the block stays
 * clean by default.
 */

import type { CSSProperties } from "react";
import { asText, colorTokenToVar, type StyleColorToken } from "@/lib/page-builder/styleToolkit";

export function GalleryHeader({
  heading,
  description,
  align = "center",
  overlay = false,
  textColorToken,
  bold = false,
  italic = false,
  underline = false,
  headingHighlight = false,
  headingHighlightToken,
  descriptionHighlight = false,
  descriptionHighlightToken,
}: {
  heading?: string;
  description?: string;
  align?: "left" | "center" | "right";
  overlay?: boolean;
  textColorToken?: StyleColorToken | string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  headingHighlight?: boolean;
  headingHighlightToken?: StyleColorToken | string;
  descriptionHighlight?: boolean;
  descriptionHighlightToken?: StyleColorToken | string;
}) {
  const h = asText(heading);
  const d = asText(description);
  if (!h && !d) return null;

  const maxWidth = align === "center" ? "40rem" : "36rem";
  const paragraphMargin =
    align === "center" ? "0.5rem auto 0" : align === "right" ? "0.5rem 0 0 auto" : "0.5rem 0 0";
  const defaultColor = overlay ? "var(--pf-color-bg)" : "var(--pf-color-fg)";
  const textColor = textColorToken ? colorTokenToVar(textColorToken) ?? defaultColor : defaultColor;
  const fontWeight = bold ? 700 : undefined;
  const fontStyle = italic ? "italic" : undefined;
  const textDecoration = underline ? "underline" : undefined;

  // A marker-pen band that hugs each wrapped line (box-decoration-break: clone),
  // its color from the picked token (falls back to the accent palette slot).
  const band = (token: StyleColorToken | string | undefined): CSSProperties => ({
    background: colorTokenToVar(token) ?? "var(--pf-color-accent)",
    color: "inherit",
    padding: "0.1em 0.3em",
    borderRadius: "0.15em",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  });

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
            fontWeight,
            fontStyle,
            textDecoration,
            // The band provides its own contrast — drop the overlay text-shadow when highlighted.
            textShadow: overlay && !headingHighlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {headingHighlight ? <mark style={band(headingHighlightToken)}>{h}</mark> : h}
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
            fontWeight,
            fontStyle,
            textDecoration,
            textShadow: overlay && !descriptionHighlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {descriptionHighlight ? <mark style={band(descriptionHighlightToken)}>{d}</mark> : d}
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
