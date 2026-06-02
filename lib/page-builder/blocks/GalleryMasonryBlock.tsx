/**
 * GalleryMasonryBlock — server component rendering a CSS column-count masonry
 * layout of a collection's gallery items.
 *
 * Multi-tenant safety: `workspaceId` is derived from the server render context
 * (never Puck props) and passed to `listItemsForBlock`, which also drops
 * private/foreign collections. A collectionId from another workspace yields 0
 * items → empty state.
 *
 * Pure CSS masonry (`column-count`) — no JS measurement library, keeps the
 * public bundle small. Images preserve their natural aspect ratio.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";
import { getRenderWorkspaceFrom, getGalleryChromeLabelsFrom, type BlockPuck } from "@/lib/page-builder/serverContext";
import { listItemsForBlock } from "@/lib/db/queries/gallery";
import { resolveBlockStyle, productionStyleField, type BlockStyle } from "@/lib/page-builder/styleToolkit";

export type GalleryMasonryProps = {
  _style?: BlockStyle;
  collectionId: string;
  columns: 2 | 3 | 4;
  gap: "tight" | "normal" | "loose";
  showCaptions: boolean;
  maxItems: number;
};

export const galleryMasonryDefaultProps: GalleryMasonryProps = {
  collectionId: "",
  columns: 3,
  gap: "normal",
  showCaptions: false,
  maxItems: 18,
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

export async function GalleryMasonryBlock({
  _style,
  collectionId,
  columns,
  gap,
  showCaptions,
  maxItems,
  puck,
}: GalleryMasonryProps & { puck?: BlockPuck }) {
  const gapValue = GAP_MAP[gap] ?? "12px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  const labels = getGalleryChromeLabelsFrom(puck);

  const workspace = getRenderWorkspaceFrom(puck);
  if (!workspace || !String(workspace._id)) {
    return <MasonryEmptyState message={labels.unavailable} />;
  }

  if (!collectionId || !collectionId.trim()) {
    return <MasonryEmptyState message={labels.noCollection} />;
  }

  let items;
  try {
    items = await listItemsForBlock({
      workspaceId: String(workspace._id),
      collectionId,
      limit: maxItems,
    });
  } catch (err) {
    console.error("GalleryMasonryBlock query failed", {
      workspaceId: String(workspace._id),
      collectionId,
      err,
    });
    return <MasonryEmptyState message={labels.error} />;
  }

  if (items.length === 0) {
    return <MasonryEmptyState message={labels.empty} />;
  }

  return (
    <section
      data-block="gallery-masonry"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
    >
      {/* Mobile-first: cap columns on small viewports (inline columnCount is the
          desktop value; the stylesheet overrides it with !important below 640px). */}
      <style>{`
        @media (max-width: 639px) { .pf-masonry { column-count: 2 !important; } }
        @media (max-width: 399px) { .pf-masonry { column-count: 1 !important; } }
      `}</style>
      <div
        className="pf-masonry"
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          columnCount: columns,
          columnGap: gapValue,
        }}
      >
        {items.map((item) => {
          const src =
            cloudinaryThumbnailUrl(item.cloudinaryPublicId, {
              width: thumbWidth,
              height: thumbWidth * 2,
              crop: "limit",
            }) || item.url;
          const alt = item.altText || item.caption || "";
          return (
            <figure
              key={String(item._id)}
              style={{
                margin: 0,
                marginBottom: gapValue,
                padding: 0,
                breakInside: "avoid",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
              {showCaptions && item.caption && (
                <figcaption
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--pf-color-fg)",
                    opacity: 0.65,
                    padding: "0.5rem 0",
                  }}
                >
                  {item.caption}
                </figcaption>
              )}
            </figure>
          );
        })}
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

export const galleryMasonryBlockConfig: ComponentConfig<GalleryMasonryProps> = {
  label: "Gallery Masonry",
  defaultProps: galleryMasonryDefaultProps,
  fields: {
    _style: productionStyleField,
    collectionId: { type: "text", label: "Collection ID" },
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
    showCaptions: {
      type: "select",
      label: "Show captions",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    } as Field<boolean>,
    maxItems: { type: "number", label: "Max items (1–100)", min: 1, max: 100 } as Field<number>,
  },
  // Async server component — Puck's PuckComponent type expects sync JSX.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: GalleryMasonryBlock as any,
};
