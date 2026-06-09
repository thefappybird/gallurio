/**
 * GalleryGridBlock — ISOMORPHIC (client-safe) responsive thumbnail grid.
 *
 * Renders purely from its own `images[]` prop (baked by the editor's multi-image
 * picker and refreshed by reconcileGalleryImages on editor-load / publish). No DB
 * access, no server context, no server-only Cloudinary import — so the SAME
 * component renders in the editor canvas AND on the public page (WYSIWYG,
 * fetch-free).
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig, Field, Fields } from "@measured/puck";
import { cloudinaryImageUrl } from "@/lib/page-builder/cloudinaryClient";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type GalleryImage = { id: string; publicId: string; alt?: string };

export type GalleryGridProps = {
  _style?: BlockStyle;
  images: GalleryImage[];
  columns: 2 | 3 | 4;
  gap: "tight" | "normal" | "loose";
};

export const galleryGridDefaultProps: GalleryGridProps = {
  images: [],
  columns: 3,
  gap: "normal",
};

const GAP_MAP: Record<GalleryGridProps["gap"], string> = {
  tight: "4px",
  normal: "8px",
  loose: "16px",
};

const THUMB_WIDTH_MAP: Record<GalleryGridProps["columns"], number> = {
  2: 800,
  3: 600,
  4: 400,
};

export function GalleryGridBlock({ _style, images, columns, gap }: GalleryGridProps) {
  const gapValue = GAP_MAP[gap] ?? "8px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  const list = Array.isArray(images) ? images : [];

  if (list.length === 0) {
    return <GalleryEmptyState message="No photos selected yet." />;
  }

  return (
    <section
      data-block="gallery-grid"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: gapValue,
          }}
        >
          {list.map((img) => {
            const src = cloudinaryImageUrl(img.publicId, {
              width: thumbWidth,
              height: thumbWidth,
              crop: "fill",
            });
            // Skip a blank publicId / unset cloud name rather than emit a broken <img src="">.
            if (!src) return null;
            return (
              <figure key={img.id} style={{ margin: 0, padding: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={img.alt ?? ""}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GalleryEmptyState({ message }: { message: string }) {
  return (
    <section
      data-block="gallery-grid"
      data-empty="true"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--pf-font-body)",
          color: "var(--pf-color-fg)",
          opacity: 0.45,
          fontSize: "0.9375rem",
          margin: 0,
        }}
      >
        {message}
      </p>
    </section>
  );
}

export const galleryGridBlockConfig: ComponentConfig<GalleryGridProps> = {
  label: "Gallery Grid",
  defaultProps: galleryGridDefaultProps,
  // `images` is intentionally absent from the sidebar fields — the editor drives
  // it via StyleToolkitField (Task 7). Production <Render> reads images straight
  // from saved props; no sidebar field is needed there either.
  fields: {
    _style: productionStyleField,
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    gap: {
      type: "select",
      label: "Gap between images",
      options: [
        { label: "Tight (4px)", value: "tight" },
        { label: "Normal (8px)", value: "normal" },
        { label: "Loose (16px)", value: "loose" },
      ],
    },
  } as unknown as Fields<GalleryGridProps>,
  render: GalleryGridBlock,
};
