/**
 * CTABannerBlock — full-width call-to-action banner.
 *
 * `background` prop controls the surface:
 * - "accent": brand accent color fill
 * - "surface": neutral card surface
 * - "image": background image (Cloudinary or fallback URL)
 *
 * CTAs are server-rendered as anchor elements:
 * - "open-contact" → `<a data-cta="contact" role="button">` (Phase 5 wires delegate)
 * - "scroll-to-section" → `<a href="#<target>">`
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig } from "@measured/puck";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CTABannerProps = {
  headline: string;
  subhead?: string;
  ctaLabel: string;
  ctaAction: "open-contact" | "scroll-to-section";
  ctaTarget?: string;
  background: "accent" | "surface" | "image";
  backgroundImagePublicId?: string;
  backgroundImageUrl?: string;
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

export const ctaBannerDefaultProps: CTABannerProps = {
  headline: "Ready to book your session?",
  subhead: "Let's create something beautiful together.",
  ctaLabel: "Get in Touch",
  ctaAction: "open-contact",
  ctaTarget: "",
  background: "accent",
  backgroundImagePublicId: "",
  backgroundImageUrl: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CTABannerBlock({
  headline,
  subhead,
  ctaLabel,
  ctaAction,
  ctaTarget,
  background,
  backgroundImagePublicId,
  backgroundImageUrl,
}: CTABannerProps) {
  const bgImageSrc =
    background === "image"
      ? backgroundImagePublicId
        ? cloudinaryThumbnailUrl(backgroundImagePublicId, { width: 1600, crop: "fill" })
        : backgroundImageUrl || null
      : null;

  // Determine text/button colors based on background type
  const onDark = background === "accent" || Boolean(bgImageSrc);

  const sectionStyle: React.CSSProperties = {
    position: "relative",
    fontFamily: "var(--pf-font-body)",
    padding: "4rem 1.5rem",
    backgroundColor:
      background === "accent"
        ? "var(--pf-color-accent)"
        : background === "surface"
          ? "var(--pf-color-secondary)"
          : "var(--pf-color-fg)", // dark fallback while image loads
    overflow: "hidden",
  };

  return (
    <section
      data-block="cta-banner"
      style={sectionStyle}
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

      {/* Scrim overlay for image background */}
      {bgImageSrc && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        />
      )}

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "48rem",
          margin: "0 auto",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--pf-font-heading)",
            fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
            color: onDark ? "#ffffff" : "var(--pf-color-fg)",
          }}
        >
          {headline}
        </h2>

        {subhead && (
          <p
            style={{
              fontSize: "1.0625rem",
              lineHeight: 1.7,
              margin: 0,
              maxWidth: "36rem",
              color: onDark ? "rgba(255,255,255,0.9)" : "var(--pf-color-fg)",
              opacity: onDark ? undefined : 0.8,
            }}
          >
            {subhead}
          </p>
        )}

        <BannerCta
          label={ctaLabel}
          action={ctaAction}
          target={ctaTarget}
          onDark={onDark}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CTA button helper
// ---------------------------------------------------------------------------

type BannerCtaProps = {
  label: string;
  action: "open-contact" | "scroll-to-section";
  target?: string;
  onDark: boolean;
};

function BannerCta({ label, action, target, onDark }: BannerCtaProps) {
  const href = action === "scroll-to-section" && target ? `#${target}` : "#";
  const dataCta = action === "open-contact" ? "contact" : undefined;

  return (
    <a
      href={href}
      role="button"
      data-cta={dataCta}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "2.75rem",
        minWidth: "9rem",
        padding: "0 1.75rem",
        fontFamily: "var(--pf-font-body)",
        fontSize: "0.9375rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textDecoration: "none",
        cursor: "pointer",
        borderRadius: "var(--pf-radius)",
        backgroundColor: onDark ? "#ffffff" : "var(--pf-color-accent)",
        color: onDark ? "var(--pf-color-accent)" : "#ffffff",
        border: "2px solid transparent",
      }}
    >
      {label}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Puck registration
// ---------------------------------------------------------------------------

export const ctaBannerBlockConfig: ComponentConfig<CTABannerProps> = {
  label: "CTA Banner",
  defaultProps: ctaBannerDefaultProps,
  fields: {
    headline: { type: "text", label: "Headline" },
    subhead: { type: "text", label: "Sub-headline (optional)" },
    ctaLabel: { type: "text", label: "CTA button label" },
    ctaAction: {
      type: "select",
      label: "CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Scroll to section", value: "scroll-to-section" },
      ],
    },
    ctaTarget: {
      type: "text",
      label: "CTA target section ID (for scroll)",
    },
    background: {
      type: "select",
      label: "Background style",
      options: [
        { label: "Accent color", value: "accent" },
        { label: "Surface (neutral)", value: "surface" },
        { label: "Image", value: "image" },
      ],
    },
    backgroundImagePublicId: {
      type: "text",
      label: "Background image (Cloudinary public ID)",
    },
    backgroundImageUrl: {
      type: "text",
      label: "Background image URL (fallback)",
    },
  },
  render: CTABannerBlock,
};
