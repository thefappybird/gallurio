/**
 * AboutBlock — heading, body text, optional image, and optional credentials list.
 *
 * Layout:
 * - Desktop (≥768px): two-column grid — text on one side, image on the other.
 *   `imagePosition` controls which column the image occupies.
 * - Mobile: stacked column, image always below text.
 *
 * Body text uses `white-space: pre-line` to preserve line breaks entered in
 * the Puck editor's textarea field.
 *
 * All branding (colors, fonts, radius) consumed via `--pf-*` CSS variables.
 * No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";
import {
  resolveBlockStyle,
  renderRichText,
  productionStyleField,
  productionRichTextField,
  type BlockStyle,
  type RichTextProp,
} from "@/lib/page-builder/styleToolkit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CredentialItem = {
  label: string;
  value: string;
};

export type AboutBlockProps = {
  _style?: BlockStyle;
  heading: RichTextProp;
  body: RichTextProp;
  imagePublicId?: string;
  imageUrl?: string;
  imagePosition: "left" | "right";
  credentials?: CredentialItem[];
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

export const aboutDefaultProps: AboutBlockProps = {
  heading: { text: "About Me" },
  body: {
    text: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
  },
  imagePublicId: "",
  imageUrl: "",
  imagePosition: "right",
  credentials: [
    { label: "Experience", value: "10+ years" },
    { label: "Location", value: "Manila, Philippines" },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AboutBlock({
  _style,
  heading,
  body,
  imagePublicId,
  imageUrl,
  imagePosition,
  credentials,
}: AboutBlockProps) {
  const imgSrc = imagePublicId
    ? cloudinaryThumbnailUrl(imagePublicId, { width: 800, height: 900, crop: "fill" })
    : imageUrl || null;

  const hasImage = Boolean(imgSrc);
  const cappedCredentials = credentials?.slice(0, 6) ?? [];
  const hd = renderRichText(heading);
  const bd = renderRichText(body);

  return (
    <section
      data-block="about"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        color: "var(--pf-color-fg)",
        fontFamily: "var(--pf-font-body)",
        padding: "4rem 1.5rem",
        ...resolveBlockStyle(_style),
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: hasImage ? "1fr 1fr" : "1fr",
          gap: "3rem",
          alignItems: "center",
          // On narrow viewports, collapse to single column
          // (mobile-first: column by default)
        }}
        className="pf-about-grid"
      >
        {/* Text column — always rendered first in DOM */}
        <div
          style={{
            order: hasImage && imagePosition === "left" ? 2 : 1,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--pf-font-heading)",
              fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              color: "var(--pf-color-fg)",
              margin: "0 0 1.5rem 0",
              ...hd.css,
            }}
          >
            {hd.text}
          </h2>

          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.8,
              color: "var(--pf-color-fg)",
              opacity: 0.85,
              margin: "0 0 2rem 0",
              whiteSpace: "pre-line",
              ...bd.css,
            }}
          >
            {bd.text}
          </p>

          {cappedCredentials.length > 0 && (
            <dl
              data-testid="credentials-list"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
                gap: "1rem",
                margin: 0,
                padding: 0,
                listStyle: "none",
              }}
            >
              {cappedCredentials.map((cred, i) => (
                <div
                  key={i}
                  style={{
                    borderTop: "2px solid var(--pf-color-accent)",
                    paddingTop: "0.75rem",
                  }}
                >
                  <dt
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--pf-color-fg)",
                      opacity: 0.55,
                      margin: "0 0 0.25rem",
                    }}
                  >
                    {cred.label}
                  </dt>
                  <dd
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "var(--pf-color-fg)",
                      margin: 0,
                    }}
                  >
                    {cred.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Image column */}
        {hasImage && (
          <div
            style={{
              order: imagePosition === "left" ? 1 : 2,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc!}
              alt={hd.text}
              style={{
                width: "100%",
                aspectRatio: "8 / 9",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        )}
      </div>

      {/* Mobile-only responsive override — collapse grid to single column */}
      <style>{`
        @media (max-width: 767px) {
          .pf-about-grid {
            grid-template-columns: 1fr !important;
          }
          .pf-about-grid > * {
            order: initial !important;
          }
        }
      `}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Puck registration
// ---------------------------------------------------------------------------

export const aboutBlockConfig: ComponentConfig<AboutBlockProps> = {
  label: "About",
  defaultProps: aboutDefaultProps,
  fields: {
    _style: productionStyleField,
    heading: productionRichTextField as Field<RichTextProp>,
    body: productionRichTextField as Field<RichTextProp>,
    imagePublicId: {
      type: "text",
      label: "Image (Cloudinary public ID)",
    },
    imageUrl: { type: "text", label: "Image URL (fallback)" },
    imagePosition: {
      type: "select",
      label: "Image position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    credentials: {
      type: "array",
      label: "Credentials (max 6)",
      arrayFields: {
        label: { type: "text", label: "Label" },
        value: { type: "text", label: "Value" },
      },
      getItemSummary: (item: CredentialItem) => item.label || "Credential",
    },
  },
  render: AboutBlock,
};
