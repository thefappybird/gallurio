/**
 * VideoBlock — an embedded YouTube or Vimeo video with optional heading,
 * description (above) and footer (below). Link-only: owners paste a YouTube or
 * Vimeo URL; we never store or proxy video files.
 *
 * `parseVideoEmbed` is a pure helper (exported for tests) that derives a safe
 * privacy-friendly embed src from the common URL shapes. Unknown URLs render the
 * block's empty state. All branding via `--pf-*` CSS variables.
 */

import type { ComponentConfig } from "@measured/puck";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  asText,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";

export type VideoBlockProps = {
  _style?: BlockStyle;
  heading: string;
  description: string;
  videoUrl: string;
  footer: string;
};

export const videoDefaultProps: VideoBlockProps = {
  heading: "",
  description: "",
  videoUrl: "",
  footer: "",
};

// ---------------------------------------------------------------------------
// URL → embed src (pure, exported for tests)
// ---------------------------------------------------------------------------

export type VideoEmbed = { provider: "youtube" | "vimeo"; src: string };

/**
 * Parse a YouTube/Vimeo URL into a privacy-friendly embed src. Returns null for
 * anything we don't recognize so the block can show its empty state rather than
 * embedding an attacker-controlled origin.
 */
export function parseVideoEmbed(rawUrl: string | undefined | null): VideoEmbed | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();
  if (!url) return null;

  // YouTube — watch?v=, youtu.be/, /embed/, /shorts/
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/) ?? null;
  if (yt?.[1]) {
    return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  }

  // Vimeo — vimeo.com/<digits> (optionally player.vimeo.com/video/<digits>).
  // Vimeo IDs are numeric and vary in length (older IDs are short), so match
  // any run of digits in the id position rather than imposing a min length.
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/) ?? null;
  if (vimeo?.[1]) {
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VideoBlock({ _style, heading, description, videoUrl, footer }: VideoBlockProps) {
  const headingText = asText(heading);
  const descriptionText = asText(description);
  const footerText = asText(footer);
  const embed = parseVideoEmbed(videoUrl);

  return (
    <section
      data-block="video"
      data-empty={embed ? undefined : "true"}
      style={{
        backgroundColor: "var(--pf-color-bg)",
        color: "var(--pf-color-fg)",
        fontFamily: "var(--pf-font-body)",
        padding: "4rem 1.5rem",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
        {(headingText || descriptionText) && (
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            {headingText && (
              <h2
                style={{
                  fontFamily: "var(--pf-font-heading)",
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  lineHeight: 1.2,
                  margin: 0,
                  color: "var(--pf-color-fg)",
                }}
              >
                {headingText}
              </h2>
            )}
            {descriptionText && (
              <p
                style={{
                  fontSize: "1rem",
                  lineHeight: 1.6,
                  margin: "0.5rem auto 0",
                  maxWidth: "40rem",
                  color: "var(--pf-color-fg)",
                  opacity: 0.75,
                  whiteSpace: "pre-line",
                }}
              >
                {descriptionText}
              </p>
            )}
          </div>
        )}

        {embed ? (
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              overflow: "hidden",
              borderRadius: "var(--pf-radius)",
              backgroundColor: "var(--pf-color-fg)",
            }}
          >
            <iframe
              src={embed.src}
              title={headingText || "Embedded video"}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid color-mix(in srgb, var(--pf-color-fg) 15%, transparent)",
            }}
          >
            <p style={{ margin: 0, opacity: 0.45, fontSize: "0.9375rem" }}>
              Paste a YouTube or Vimeo link to embed a video.
            </p>
          </div>
        )}

        {footerText && (
          <p
            style={{
              textAlign: "center",
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              margin: "1.5rem auto 0",
              maxWidth: "40rem",
              color: "var(--pf-color-fg)",
              opacity: 0.75,
              whiteSpace: "pre-line",
            }}
          >
            {footerText}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Puck registration (production)
// ---------------------------------------------------------------------------

export const videoBlockConfig: ComponentConfig<VideoBlockProps> = {
  label: "Video",
  defaultProps: videoDefaultProps,
  fields: {
    _style: productionStyleField,
    heading: { type: "text", label: "Heading" },
    description: { type: "textarea", label: "Description" },
    videoUrl: { type: "text", label: "YouTube or Vimeo URL" },
    footer: { type: "textarea", label: "Footer" },
  },
  render: VideoBlock,
};
