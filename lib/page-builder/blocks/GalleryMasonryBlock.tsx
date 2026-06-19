/**
 * GalleryMasonryBlock — ISOMORPHIC (client-safe) CSS column-count masonry layout.
 *
 * Renders from its own `images[]` prop (no DB, no server context, no server-only
 * imports). Empty-state copy is read from `puck.metadata` chrome via
 * getGalleryChromeLabelsFrom (a pure, client-safe prop read) so a localized public
 * render still gets translated copy, falling back to English.
 */

import type { ComponentConfig, Field, Fields } from "@measured/puck";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { getGalleryChromeLabelsFrom, type BlockPuck } from "@/lib/page-builder/blockContext";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";
import type { GalleryImage } from "./GalleryGridBlock";
import { padVar, masonryColsVar } from "@/lib/page-builder/responsive";

export type GalleryMasonryProps = {
  _style?: BlockStyle;
  images: GalleryImage[];
  columns: 2 | 3 | 4;
  gap: "tight" | "normal" | "loose";
};

export const galleryMasonryDefaultProps: GalleryMasonryProps = {
  images: [],
  columns: 3,
  gap: "normal",
};

const GAP_MAP: Record<GalleryMasonryProps["gap"], string> = {
  tight: "4px",
  normal: "12px",
  loose: "24px",
};

const THUMB_WIDTH_MAP: Record<GalleryMasonryProps["columns"], number> = {
  2: 800,
  3: 600,
  4: 400,
};

export function GalleryMasonryBlock({
  _style,
  images,
  columns,
  gap,
  puck,
}: GalleryMasonryProps & { puck?: BlockPuck }) {
  const gapValue = GAP_MAP[gap] ?? "12px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  const labels = getGalleryChromeLabelsFrom(puck);
  const list = Array.isArray(images) ? images : [];

  if (list.length === 0) {
    return <MasonryEmptyState message={labels.empty} />;
  }

  return (
    <section
      data-block="gallery-masonry"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: padVar("4rem 1.5rem"),
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
        <div className="pf-masonry" style={{ columnCount: masonryColsVar(columns) as unknown as number, columnGap: gapValue }}>
          {list.map((img) => {
            const src = imageDeliveryUrl(img.publicId, {
              width: thumbWidth,
              height: thumbWidth * 2,
              fit: "scale-down",
            });
            if (!src) return null;
            return (
              <figure
                key={img.id}
                style={{ margin: 0, marginBottom: gapValue, padding: 0, breakInside: "avoid" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={img.alt ?? ""}
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MasonryEmptyState({ message }: { message: string }) {
  return (
    <section
      data-block="gallery-masonry"
      data-empty="true"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: padVar("4rem 1.5rem"),
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

export const galleryMasonryBlockConfig: ComponentConfig<GalleryMasonryProps> = {
  label: "Masonry",
  defaultProps: galleryMasonryDefaultProps,
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
        { label: "Tight", value: "tight" },
        { label: "Normal", value: "normal" },
        { label: "Loose", value: "loose" },
      ],
    },
  } as unknown as Fields<GalleryMasonryProps>,
  render: GalleryMasonryBlock,
};
