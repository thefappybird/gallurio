/**
 * GalleryGridBlock — server component that queries gallery items for a given
 * collection and renders a responsive thumbnail grid.
 *
 * Multi-tenant safety:
 * - `workspaceId` is NEVER taken from Puck props. It is always derived from
 *   the server render context set by the renderer page before <Render>.
 * - The query always filters by { workspaceId, collectionId } together, so
 *   a Puck prop that supplies a collectionId from another workspace returns 0
 *   items (the workspaceId mismatch eliminates the rows).
 *
 * Renders an empty-state placeholder when:
 * - `collectionId` is empty / missing from props
 * - no GalleryItems match { workspaceId, collectionId }
 * - the server context workspaceId is not set (should not happen in production
 *   but handled gracefully to avoid hard crashes during previews)
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";
import { getRenderWorkspaceFrom, type BlockPuck } from "@/lib/page-builder/serverContext";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";
import { GalleryHeader, GalleryFooter } from "./GalleryText";
import { Types } from "mongoose";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type GalleryGridProps = {
  _style?: BlockStyle;
  heading: string;
  description: string;
  footer: string;
  collectionId: string;
  columns: 2 | 3 | 4;
  gap: "tight" | "normal" | "loose";
  maxItems: number;
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

export const galleryGridDefaultProps: GalleryGridProps = {
  heading: "",
  description: "",
  footer: "",
  collectionId: "",
  columns: 3,
  gap: "normal",
  maxItems: 12,
};

// ---------------------------------------------------------------------------
// Gap → pixel value
// ---------------------------------------------------------------------------

const GAP_MAP: Record<GalleryGridProps["gap"], string> = {
  tight: "4px",
  normal: "8px",
  loose: "16px",
};

// ---------------------------------------------------------------------------
// Thumbnail size by columns
// ---------------------------------------------------------------------------

const THUMB_WIDTH_MAP: Record<GalleryGridProps["columns"], number> = {
  2: 800,
  3: 600,
  4: 400,
};

// ---------------------------------------------------------------------------
// Lean item shape
// ---------------------------------------------------------------------------

type LeanGalleryItem = {
  _id: Types.ObjectId;
  cloudinaryPublicId: string;
  url: string;
  caption: string;
  altText: string;
  order: number;
  width: number | null;
  height: number | null;
};

// ---------------------------------------------------------------------------
// Component (async server component)
// ---------------------------------------------------------------------------

export async function GalleryGridBlock({
  _style,
  heading,
  description,
  footer,
  collectionId,
  columns,
  gap,
  maxItems,
  puck,
}: GalleryGridProps & { puck?: BlockPuck }) {
  const gapValue = GAP_MAP[gap] ?? "8px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  const cappedMax = Math.min(Math.max(1, maxItems), 100);

  // Guard: no collection specified
  if (!collectionId || !collectionId.trim()) {
    return <GalleryEmptyState message="No collection selected." />;
  }

  // Guard: no workspace context (preview / test without context)
  const workspace = getRenderWorkspaceFrom(puck);
  if (!workspace) {
    return <GalleryEmptyState message="Gallery not available." />;
  }

  const workspaceId = String(workspace._id);

  // Guard: workspace ID must be a non-empty string (e.g. not "" from a test fixture
  // or an isolated preview context without a real workspace).
  if (!workspaceId) {
    return <GalleryEmptyState message="Gallery not available." />;
  }

  // Guard: collectionId must be a valid ObjectId — a malformed string is a
  // configuration error, not a DB outage; render the empty state rather than
  // letting Mongoose throw a CastError that falls into the DB-outage catch.
  if (!Types.ObjectId.isValid(collectionId)) {
    return <GalleryEmptyState message="No collection selected." />;
  }

  let items: LeanGalleryItem[] = [];

  try {
    await connectDB();
    items = (await GalleryItem.find({ workspaceId, collectionId })
      .sort({ order: 1, _id: 1 })
      .limit(cappedMax)
      .lean()) as unknown as LeanGalleryItem[];
  } catch (err) {
    console.error("GalleryGridBlock query failed", err);
    // DB unavailable during SSG or in isolated preview — degrade gracefully
    return <GalleryEmptyState message="Gallery temporarily unavailable." />;
  }

  if (items.length === 0) {
    return <GalleryEmptyState message="No photos in this collection yet." />;
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
      <div
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
        }}
      >
        <GalleryHeader heading={heading} description={description} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: gapValue,
          }}
        >
          {items.map((item) => {
            const src =
              cloudinaryThumbnailUrl(item.cloudinaryPublicId, {
                width: thumbWidth,
                height: thumbWidth,
                crop: "fill",
              }) || item.url;
            const alt = item.altText || item.caption || "";

            return (
              <figure
                key={String(item._id)}
                style={{ margin: 0, padding: 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  loading="lazy"
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </figure>
            );
          })}
        </div>
        <GalleryFooter footer={footer} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Puck registration
// ---------------------------------------------------------------------------

export const galleryGridBlockConfig: ComponentConfig<GalleryGridProps> = {
  label: "Gallery Grid",
  defaultProps: galleryGridDefaultProps,
  fields: {
    _style: productionStyleField,
    heading: { type: "text", label: "Heading" },
    description: { type: "textarea", label: "Description" },
    footer: { type: "textarea", label: "Footer" },
    collectionId: {
      type: "text",
      label: "Collection ID",
    },
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
    maxItems: {
      type: "number",
      label: "Max items (1–100)",
      min: 1,
      max: 100,
    } as Field<number>,
  },
  // GalleryGridBlock is an async server component — Puck's PuckComponent type
  // expects synchronous JSX.Element, so we cast here. The RSC renderer handles
  // async components natively; this cast is safe in Next.js RSC context.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: GalleryGridBlock as any,
};
