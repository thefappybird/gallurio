/**
 * GalleryCarouselBlock — server component that fetches a collection's items and
 * hands already-resolved thumbnail URLs to the client carousel island.
 *
 * Multi-tenant safety: `workspaceId` comes from the server render context, never
 * Puck props. `listItemsForBlock` drops private/foreign collections.
 *
 * Split design: the fetch + tenant scoping happen on the server (AsyncLocalStorage
 * is server-only); only the interactive scroll/arrow logic ships to the client.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";
import { getRenderWorkspaceFrom, getGalleryChromeLabelsFrom, type BlockPuck } from "@/lib/page-builder/serverContext";
import { listItemsForBlock } from "@/lib/db/queries/gallery";
import { GalleryCarouselClient, type CarouselSlide } from "./GalleryCarouselClient";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";
import { GalleryHeader } from "./GalleryText";

export type GalleryCarouselProps = {
  _style?: BlockStyle;
  heading: string;
  description: string;
  collectionId: string;
  aspect: "square" | "landscape" | "portrait";
  overlayAlign: "left" | "center" | "right";
  autoplay: boolean;
  maxItems: number;
};

export const galleryCarouselDefaultProps: GalleryCarouselProps = {
  heading: "",
  description: "",
  collectionId: "",
  aspect: "landscape",
  overlayAlign: "center",
  autoplay: false,
  maxItems: 12,
};

const THUMB_SIZE: Record<GalleryCarouselProps["aspect"], { width: number; height: number }> = {
  square: { width: 800, height: 800 },
  landscape: { width: 1000, height: 562 },
  portrait: { width: 700, height: 933 },
};

export async function GalleryCarouselBlock({
  _style,
  heading,
  description,
  collectionId,
  aspect,
  overlayAlign,
  autoplay,
  maxItems,
  puck,
}: GalleryCarouselProps & { puck?: BlockPuck }) {
  const labels = getGalleryChromeLabelsFrom(puck);
  const workspace = getRenderWorkspaceFrom(puck);
  if (!workspace || !String(workspace._id)) {
    return <CarouselEmptyState message={labels.unavailable} />;
  }

  if (!collectionId || !collectionId.trim()) {
    return <CarouselEmptyState message={labels.noCollection} />;
  }

  let items;
  try {
    items = await listItemsForBlock({
      workspaceId: String(workspace._id),
      collectionId,
      limit: maxItems,
    });
  } catch (err) {
    console.error("GalleryCarouselBlock query failed", {
      workspaceId: String(workspace._id),
      collectionId,
      err,
    });
    return <CarouselEmptyState message={labels.error} />;
  }

  if (items.length === 0) {
    return <CarouselEmptyState message={labels.empty} />;
  }

  const size = THUMB_SIZE[aspect] ?? THUMB_SIZE.landscape;
  const slides: CarouselSlide[] = items.map((item) => ({
    id: String(item._id),
    src:
      cloudinaryThumbnailUrl(item.cloudinaryPublicId, {
        width: size.width,
        height: size.height,
        crop: "fill",
      }) || item.url,
    alt: item.altText || item.caption || "",
  }));

  return (
    <section
      data-block="gallery-carousel"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "0.75rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ position: "relative", maxWidth: "80rem", margin: "0 auto" }}>
        <GalleryCarouselClient
          slides={slides}
          aspect={aspect}
          autoplay={autoplay}
          labels={{ hint: labels.carouselHint, prev: labels.carouselPrev, next: labels.carouselNext }}
        />
        <div
          data-gallery-overlay="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent:
              overlayAlign === "left"
                ? "flex-start"
                : overlayAlign === "right"
                ? "flex-end"
                : "center",
            padding: "1.5rem",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "min(100%, 40rem)",
            }}
          >
            <GalleryHeader
              heading={heading}
              description={description}
              align={overlayAlign}
              overlay
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CarouselEmptyState({ message }: { message: string }) {
  return (
    <section
      data-block="gallery-carousel"
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

export const galleryCarouselBlockConfig: ComponentConfig<GalleryCarouselProps> = {
  label: "Gallery Carousel",
  defaultProps: galleryCarouselDefaultProps,
  fields: {
    _style: productionStyleField,
    heading: { type: "text", label: "Heading" },
    description: { type: "textarea", label: "Description" },
    collectionId: { type: "text", label: "Collection ID" },
    aspect: {
      type: "select",
      label: "Image shape",
      options: [
        { label: "Square", value: "square" },
        { label: "Landscape", value: "landscape" },
        { label: "Portrait", value: "portrait" },
      ],
    },
    overlayAlign: {
      type: "select",
      label: "Overlay align",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    } as Field<"left" | "center" | "right">,
    autoplay: {
      type: "select",
      label: "Autoplay",
      options: [
        { label: "Off", value: false },
        { label: "On", value: true },
      ],
    } as Field<boolean>,
    maxItems: { type: "number", label: "Max items (1–100)", min: 1, max: 100 } as Field<number>,
  },
  // Async server component — Puck's PuckComponent type expects sync JSX.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: GalleryCarouselBlock as any,
};
