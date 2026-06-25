/**
 * FeaturedWorkBlock — isomorphic (client-safe) collections showcase.
 *
 * Renders a tile grid of curated gallery collections from its own `collections[]`
 * prop (baked by the editor's MediaPicker collections mode and refreshed by
 * reconcileFeaturedCollections on editor-load / publish). No DB access, no
 * server-only imports — the SAME component renders in the editor canvas AND on the
 * public page (WYSIWYG, fetch-free).
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig, Field, Fields } from "@measured/puck";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
  type GalleryColumns,
} from "@/lib/page-builder/styleToolkit";
import {
  getGalleryChromeLabelsFrom,
  type BlockPuck,
} from "@/lib/page-builder/blockContext";
import { FeaturedCollectionsClient } from "./FeaturedCollectionsClient";
import { padVar } from "@/lib/page-builder/responsive";
import type { GalleryImage } from "./GalleryGridBlock";
import { GALLERY_MIN_HEIGHT, resolveBannerLayers } from "./GalleryGridBlock";
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";
import type { ContainerHeight } from "./manualBlocks";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type FeaturedCollectionRef = {
  id: string;
  name: string;
  coverPublicId: string;
  itemCount: number;
};

export type FeaturedWorkProps = {
  _style?: BlockStyle;
  collections: FeaturedCollectionRef[];
  // Banner / container props (same as ContainerBlock)
  backgroundImages?: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
};

export const featuredWorkDefaultProps: FeaturedWorkProps = {
  collections: [],
  backgroundImages: [],
  bgAnimation: "crossfade",
  bgSpeed: "medium",
};

// ---------------------------------------------------------------------------
// Banner background sub-render (same pattern as ContainerBlock)
// ---------------------------------------------------------------------------

function GalleryBannerLayers({
  layers,
  bgAnimation,
  bgSpeed,
  overlayAlpha,
}: {
  layers: { id: string; src: string }[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayAlpha: number;
}) {
  return (
    <>
      {overlayAlpha > 0 && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, zIndex: 1, backgroundColor: `rgba(0,0,0,${overlayAlpha})` }}
        />
      )}
      {layers.length === 1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={layers[0].src}
          alt=""
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {layers.length >= 2 && (
        <ContainerBackgroundSlideshow
          images={layers}
          animation={bgAnimation ?? "crossfade"}
          speed={bgSpeed ?? "medium"}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component (sync — isomorphic)
// ---------------------------------------------------------------------------

export function FeaturedWorkBlock({
  _style,
  collections,
  backgroundImages,
  bgAnimation,
  bgSpeed,
  overlayOpacity,
  minHeight,
  puck,
}: FeaturedWorkProps & { puck?: BlockPuck }) {
  const columns: GalleryColumns = _style?.galleryColumns ?? 3;
  const ws = puck?.metadata?.workspace;
  const slug = ws?.slug;
  const editorPreview = ws?.editorPreview ?? false;
  const mode = editorPreview ? "owner" : "public";
  const popupConfig = ws?.publicPage?.collectionsPopup ?? {};

  const labels = getGalleryChromeLabelsFrom(puck);
  const list = Array.isArray(collections) ? collections : [];

  const tiles = list.map((c) => ({
    id: c.id,
    name: c.name,
    count: c.itemCount ?? 0,
    coverUrl: imageDeliveryUrl(c.coverPublicId, { width: 700, height: 900, fit: "cover" }),
  }));

  const layers = resolveBannerLayers(backgroundImages);
  const hasBg = layers.length > 0;
  const overlayAlpha = Math.min(100, Math.max(0, overlayOpacity ?? 0)) / 100;
  const sectionStyle = resolveBlockStyle(_style);

  return (
    <section
      ref={puck?.dragRef ?? undefined}
      data-block="featured-work"
      data-empty={list.length === 0 ? "true" : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: hasBg ? "var(--pf-color-fg)" : "var(--pf-color-bg)",
        minHeight: GALLERY_MIN_HEIGHT[minHeight ?? "auto"],
        padding: padVar("4rem 1.5rem"),
        fontFamily: "var(--pf-font-body)",
        ...sectionStyle,
      }}
      {...resolveBlockAttrs(_style)}
    >
      {hasBg && (
        <GalleryBannerLayers layers={layers} bgAnimation={bgAnimation} bgSpeed={bgSpeed} overlayAlpha={overlayAlpha} />
      )}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "72rem", margin: "0 auto" }}>
        {list.length === 0 ? (
          <p
            style={{
              color: "var(--pf-color-fg)",
              opacity: 0.45,
              textAlign: "center",
              fontSize: "0.9375rem",
              marginTop: "2rem",
            }}
          >
            {labels.featuredEmpty}
          </p>
        ) : (
          <FeaturedCollectionsClient
            tiles={tiles}
            columns={columns}
            mode={mode}
            slug={slug}
            popupConfig={popupConfig}
          />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const featuredWorkBlockConfig: ComponentConfig<FeaturedWorkProps> = {
  label: "Highlights",
  inline: true,
  defaultProps: featuredWorkDefaultProps,
  // `collections` is intentionally absent from the sidebar fields — the editor drives
  // it via StyleToolkitField Content tab. Production <Render> reads collections straight
  // from saved props; no sidebar field is needed there either.
  // columns is now stored in _style.galleryColumns and edited via the Layout tab
  // GalleryLayoutControls — not as a top-level sidebar field.
  // Banner fields are managed by StyleToolkitField and stripped by resolveFields in editorConfig.
  fields: {
    _style: productionStyleField,
    backgroundImages: {
      type: "array",
      label: "Background images",
      arrayFields: { id: { type: "text", label: "ID" }, publicId: { type: "text", label: "Public ID" } },
    } as unknown as Field<GalleryImage[] | undefined>,
    bgAnimation: {
      type: "select",
      label: "BG animation",
      options: [
        { label: "Crossfade", value: "crossfade" },
        { label: "Ken Burns", value: "kenburns" },
        { label: "Slide", value: "slide" },
      ],
    } as Field<FeaturedWorkProps["bgAnimation"]>,
    bgSpeed: {
      type: "select",
      label: "BG speed",
      options: [
        { label: "Slow", value: "slow" },
        { label: "Medium", value: "medium" },
        { label: "Fast", value: "fast" },
      ],
    } as Field<FeaturedWorkProps["bgSpeed"]>,
    overlayOpacity: {
      type: "number",
      label: "Overlay opacity",
      min: 0,
      max: 100,
    } as Field<number | undefined>,
    minHeight: {
      type: "select",
      label: "Min height",
      options: [
        { label: "Auto", value: "auto" },
        { label: "Short", value: "short" },
        { label: "Medium", value: "medium" },
        { label: "Tall", value: "tall" },
      ],
    } as Field<ContainerHeight | undefined>,
  } as unknown as Fields<FeaturedWorkProps>,
  render: FeaturedWorkBlock,
};
