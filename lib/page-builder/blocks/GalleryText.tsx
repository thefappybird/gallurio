/**
 * Carousel heading/description text + a shared gallery footer. Server-safe (no
 * "use client"). `GalleryHeader` is consumed only by GalleryCarouselBlock, which
 * styles the heading and description independently via per-target `_style` groups
 * (color, bold/italic/underline, align, font, level/size, highlight band). An
 * empty value renders nothing so the block stays clean by default.
 */

import type { CSSProperties } from "react";
import {
  asText,
  colorTokenToVar,
  type StyleColorToken,
  type TextAlign,
  type HeadingLevel,
  type HighlightShape,
  type HighlightSize,
} from "@/lib/page-builder/styleToolkit";
import { fontFamilyValue, type PortfolioFontKey } from "@/lib/page-builder/fonts";

// Fixed level → size scale, mirrors HeadingBlock's HEADING_SIZE (manualBlocks.tsx)
// so the carousel heading matches the rest of the builder's heading sizes.
const HEADING_LEVEL_SIZE: Record<HeadingLevel, string> = {
  h1: "3rem",
  h2: "2.25rem",
  h3: "1.75rem",
  h4: "1.375rem",
  h5: "1.125rem",
  h6: "0.875rem",
};

const HL_RADIUS: Record<HighlightShape, string> = {
  sharp: "0",
  subtle: "0.15em",
  rounded: "0.6em",
};

const HL_PADDING: Record<HighlightSize, string> = {
  sm: "0.05em 0.2em",
  md: "0.1em 0.3em",
  lg: "0.2em 0.45em",
};

type GalleryTextTargetStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  colorToken?: StyleColorToken | string;
  fontFamily?: PortfolioFontKey;
  highlight?: boolean;
  highlightToken?: StyleColorToken | string;
  highlightShape?: HighlightShape;
  highlightSize?: HighlightSize;
};

// A marker-pen band that hugs each wrapped line (box-decoration-break: clone),
// its color/shape/size from the picked options (defaults match the prior band).
function band(
  token: StyleColorToken | string | undefined,
  shape: HighlightShape | undefined,
  size: HighlightSize | undefined
): CSSProperties {
  return {
    background: colorTokenToVar(token) ?? "var(--pf-color-accent)",
    color: "inherit",
    padding: HL_PADDING[size ?? "md"],
    borderRadius: HL_RADIUS[shape ?? "subtle"],
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  };
}

export function GalleryHeader({
  heading,
  description,
  align = "center",
  overlay = false,
  headingStyle = {},
  descriptionStyle = {},
}: {
  heading?: string;
  description?: string;
  align?: TextAlign;
  overlay?: boolean;
  headingStyle?: GalleryTextTargetStyle & { level?: HeadingLevel };
  descriptionStyle?: GalleryTextTargetStyle & { fontSize?: number };
}) {
  const h = asText(heading);
  const d = asText(description);
  if (!h && !d) return null;

  const defaultColor = overlay ? "var(--pf-color-bg)" : "var(--pf-color-fg)";

  // Heading
  const HeadingTag = (headingStyle.level ?? "h2") as HeadingLevel;
  const hAlign = headingStyle.align ?? align;
  const hColor = headingStyle.colorToken
    ? colorTokenToVar(headingStyle.colorToken) ?? defaultColor
    : defaultColor;

  // Description
  const dAlign = descriptionStyle.align ?? align;
  const dColor = descriptionStyle.colorToken
    ? colorTokenToVar(descriptionStyle.colorToken) ?? defaultColor
    : defaultColor;
  const dMaxWidth = dAlign === "center" ? "40rem" : "36rem";
  const dMargin =
    dAlign === "center" ? "0.5rem auto 0" : dAlign === "right" ? "0.5rem 0 0 auto" : "0.5rem 0 0";

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {h && (
        <HeadingTag
          style={{
            fontFamily: fontFamilyValue(headingStyle.fontFamily) ?? "var(--pf-font-heading)",
            fontSize: HEADING_LEVEL_SIZE[HeadingTag],
            lineHeight: 1.2,
            color: hColor,
            margin: 0,
            textAlign: hAlign,
            fontWeight: headingStyle.bold ? 700 : undefined,
            fontStyle: headingStyle.italic ? "italic" : undefined,
            textDecoration: headingStyle.underline ? "underline" : undefined,
            // The band provides its own contrast — drop the overlay text-shadow when highlighted.
            textShadow: overlay && !headingStyle.highlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {headingStyle.highlight ? (
            <mark style={band(headingStyle.highlightToken, headingStyle.highlightShape, headingStyle.highlightSize)}>
              {h}
            </mark>
          ) : (
            h
          )}
        </HeadingTag>
      )}
      {d && (
        <p
          style={{
            fontFamily: fontFamilyValue(descriptionStyle.fontFamily) ?? "var(--pf-font-body)",
            fontSize: descriptionStyle.fontSize ? `${descriptionStyle.fontSize}px` : "1rem",
            lineHeight: 1.6,
            color: dColor,
            opacity: overlay ? 0.92 : 0.75,
            maxWidth: dMaxWidth,
            margin: dMargin,
            textAlign: dAlign,
            whiteSpace: "pre-line",
            fontWeight: descriptionStyle.bold ? 700 : undefined,
            fontStyle: descriptionStyle.italic ? "italic" : undefined,
            textDecoration: descriptionStyle.underline ? "underline" : undefined,
            textShadow: overlay && !descriptionStyle.highlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {descriptionStyle.highlight ? (
            <mark
              style={band(descriptionStyle.highlightToken, descriptionStyle.highlightShape, descriptionStyle.highlightSize)}
            >
              {d}
            </mark>
          ) : (
            d
          )}
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
