/**
 * HeroBlock — full-bleed hero section with background image/color, headline,
 * subhead, and a primary + optional secondary CTA pair.
 *
 * - Background: Cloudinary image (derived via cloudinaryThumbnailUrl) when
 *   `backgroundImagePublicId` is provided; otherwise falls back to an accent
 *   color gradient using `--pf-color-accent`.
 * - CTAs are server-rendered as anchor elements. `open-contact` uses the
 *   `data-cta="contact"` marker attribute (wired by Phase 5 JS delegate).
 *   `scroll-to-section` uses `href="#<target>"`.
 * - All branding (colors, fonts, radius) consumed via `--pf-*` CSS variables.
 * - No `rounded-*` Tailwind classes; radius applied via inline style.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type HeroBlockProps = {
  headline: string;
  subhead?: string;
  backgroundImagePublicId?: string;
  backgroundImageUrl?: string;
  backgroundOverlayOpacity: number;
  primaryCtaLabel: string;
  primaryCtaAction: "open-contact" | "scroll-to-section";
  primaryCtaTarget?: string;
  secondaryCtaLabel?: string;
  secondaryCtaAction?: "open-contact" | "scroll-to-section";
  secondaryCtaTarget?: string;
  alignment: "left" | "center";
  height: "tall" | "medium" | "short";
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

export const heroDefaultProps: HeroBlockProps = {
  headline: "Capturing moments that last forever",
  subhead: "Fine art photography for weddings, portraits, and events.",
  backgroundImagePublicId: "",
  backgroundImageUrl: "",
  backgroundOverlayOpacity: 50,
  primaryCtaLabel: "Get in Touch",
  primaryCtaAction: "open-contact",
  primaryCtaTarget: "",
  secondaryCtaLabel: "View Work",
  secondaryCtaAction: "scroll-to-section",
  secondaryCtaTarget: "gallery",
  alignment: "center",
  height: "tall",
};

// ---------------------------------------------------------------------------
// Height variant → min-height value
// ---------------------------------------------------------------------------

const HEIGHT_MAP: Record<HeroBlockProps["height"], string> = {
  tall: "80vh",
  medium: "60vh",
  short: "40vh",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HeroBlock({
  headline,
  subhead,
  backgroundImagePublicId,
  backgroundImageUrl,
  backgroundOverlayOpacity,
  primaryCtaLabel,
  primaryCtaAction,
  primaryCtaTarget,
  secondaryCtaLabel,
  secondaryCtaAction,
  secondaryCtaTarget,
  alignment,
  height,
}: HeroBlockProps) {
  const minHeight = HEIGHT_MAP[height] ?? "80vh";
  const overlayAlpha = Math.min(100, Math.max(0, backgroundOverlayOpacity)) / 100;

  // Resolve background image URL
  const bgImageSrc =
    backgroundImagePublicId
      ? cloudinaryThumbnailUrl(backgroundImagePublicId, { width: 2000, crop: "fill" })
      : backgroundImageUrl || null;

  // Wrapper inline styles — brand-kit colors via CSS vars
  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: alignment === "center" ? "center" : "flex-start",
    minHeight,
    fontFamily: "var(--pf-font-body)",
    backgroundColor: bgImageSrc
      ? "var(--pf-color-fg)" // dark fallback while image loads
      : undefined,
    // Accent gradient fallback when no image
    background: bgImageSrc
      ? undefined
      : "linear-gradient(135deg, var(--pf-color-accent) 0%, var(--pf-color-primary) 100%)",
    overflow: "hidden",
  };

  return (
    <section
      data-block="hero"
      style={wrapperStyle}
      aria-label="Hero section"
    >
      {/* Background image */}
      {bgImageSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgImageSrc}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      )}

      {/* Overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(0,0,0,${overlayAlpha})`,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "72rem",
          margin: "0 auto",
          padding: "4rem 1.5rem",
          textAlign: alignment,
          display: "flex",
          flexDirection: "column",
          alignItems: alignment === "center" ? "center" : "flex-start",
          gap: "1.5rem",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--pf-font-heading)",
            fontSize: "clamp(2rem, 5vw, 4rem)",
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#ffffff",
            margin: 0,
          }}
        >
          {headline}
        </h1>

        {subhead && (
          <p
            style={{
              fontFamily: "var(--pf-font-body)",
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.9)",
              maxWidth: "36rem",
              margin: 0,
            }}
          >
            {subhead}
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: alignment === "center" ? "center" : "flex-start",
          }}
        >
          <CtaButton
            label={primaryCtaLabel}
            action={primaryCtaAction}
            target={primaryCtaTarget}
            variant="primary"
          />
          {secondaryCtaLabel && secondaryCtaAction && (
            <CtaButton
              label={secondaryCtaLabel}
              action={secondaryCtaAction}
              target={secondaryCtaTarget}
              variant="secondary"
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CTA button helper — server-renderable
// ---------------------------------------------------------------------------

type CtaButtonProps = {
  label: string;
  action: "open-contact" | "scroll-to-section";
  target?: string;
  variant: "primary" | "secondary";
};

function CtaButton({ label, action, target, variant }: CtaButtonProps) {
  const href = action === "scroll-to-section" && target ? `#${target}` : "#";
  const dataCta = action === "open-contact" ? "contact" : undefined;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "2.75rem",
    minWidth: "8rem",
    padding: "0 1.5rem",
    fontFamily: "var(--pf-font-body)",
    fontSize: "0.9375rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textDecoration: "none",
    cursor: "pointer",
    borderRadius: "var(--pf-radius)",
    transition: "opacity 0.15s",
  };

  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? {
          backgroundColor: "var(--pf-color-accent)",
          color: "#ffffff",
          border: "2px solid transparent",
        }
      : {
          backgroundColor: "transparent",
          color: "#ffffff",
          border: "2px solid rgba(255,255,255,0.7)",
        };

  return (
    <a
      href={href}
      role="button"
      data-cta={dataCta}
      style={{ ...baseStyle, ...variantStyle }}
    >
      {label}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Puck registration
// ---------------------------------------------------------------------------

export const heroBlockConfig: ComponentConfig<HeroBlockProps> = {
  label: "Hero",
  defaultProps: heroDefaultProps,
  fields: {
    headline: { type: "text", label: "Headline" },
    subhead: { type: "text", label: "Sub-headline (optional)" },
    backgroundImagePublicId: {
      type: "text",
      label: "Background image (Cloudinary public ID)",
    },
    backgroundImageUrl: {
      type: "text",
      label: "Background image URL (fallback)",
    },
    backgroundOverlayOpacity: {
      type: "number",
      label: "Overlay opacity (0–100)",
      min: 0,
      max: 100,
    } as Field<number>,
    primaryCtaLabel: { type: "text", label: "Primary CTA label" },
    primaryCtaAction: {
      type: "select",
      label: "Primary CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Scroll to section", value: "scroll-to-section" },
      ],
    },
    primaryCtaTarget: {
      type: "text",
      label: "Primary CTA target section ID (for scroll)",
    },
    secondaryCtaLabel: { type: "text", label: "Secondary CTA label (optional)" },
    secondaryCtaAction: {
      type: "select",
      label: "Secondary CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Scroll to section", value: "scroll-to-section" },
      ],
    },
    secondaryCtaTarget: {
      type: "text",
      label: "Secondary CTA target section ID",
    },
    alignment: {
      type: "select",
      label: "Content alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
      ],
    },
    height: {
      type: "select",
      label: "Section height",
      options: [
        { label: "Tall (80vh)", value: "tall" },
        { label: "Medium (60vh)", value: "medium" },
        { label: "Short (40vh)", value: "short" },
      ],
    },
  },
  render: HeroBlock,
};
