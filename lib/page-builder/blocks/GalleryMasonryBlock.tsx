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
import {
  getGalleryChromeLabelsFrom,
  type BlockPuck,
} from "@/lib/page-builder/blockContext";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
  type GalleryColumns,
  type GalleryGap,
} from "@/lib/page-builder/styleToolkit";
import type { GalleryImage } from "./GalleryGridBlock";
import { resolveGalleryMinHeight, resolveBannerLayers } from "./GalleryGridBlock";
import { GALLERY_PAD_SHORTHAND, padVar, masonryColsVar } from "@/lib/page-builder/responsive";
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";
import { GalleryLightboxTrigger } from "./GalleryLightboxTrigger";
import { PresetMediaPlaceholder } from "./PresetMediaPlaceholder";
import type { ContainerHeight } from "./manualBlocks";

export type GalleryMasonryProps = {
  _style?: BlockStyle;
  images: GalleryImage[];
  // Banner / container props (same as ContainerBlock)
  backgroundImages?: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  /** CSS length value when minHeight === "custom", e.g. "400px" or "50vh". */
  minHeightValue?: string;
};

export const galleryMasonryDefaultProps: GalleryMasonryProps = {
  images: [],
  backgroundImages: [],
  bgAnimation: "crossfade",
  bgSpeed: "medium",
};

const GAP_MAP: Record<GalleryGap, string> = {
  tight: "4px",
  normal: "12px",
  loose: "24px",
};

const THUMB_WIDTH_MAP: Record<GalleryColumns, number> = {
  2: 800,
  3: 600,
  4: 400,
};

/**
 * Deterministic per-column vertical offset (px) for the opt-in stagger mode
 * (`_style.galleryStagger`). Cycles by `index % columns` so adjacent columns
 * in the same row always get a different offset, producing a genuine masonry
 * read even when every source photo shares one aspect ratio (the reported
 * bug — column-count masonry alone looks like a grid when rows align).
 * Fixed values, no randomness — stable across renders and SSR/hydration.
 */
const STAGGER_OFFSET_CYCLE = [0, 32, 16, 48] as const; // covers columns 2 | 3 | 4

export function galleryStaggerOffsetPx(index: number, columns: GalleryColumns): number {
  return STAGGER_OFFSET_CYCLE[index % columns] ?? 0;
}

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

export function GalleryMasonryBlock({
  _style,
  images,
  backgroundImages,
  bgAnimation,
  bgSpeed,
  overlayOpacity,
  minHeight,
  minHeightValue,
  puck,
}: GalleryMasonryProps & { puck?: BlockPuck }) {
  const columns = _style?.galleryColumns ?? 3;
  const gap = _style?.galleryGap ?? "normal";
  const gapValue = GAP_MAP[gap] ?? "12px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  // Opt-in, default OFF — unset renders byte-identical to the pre-existing
  // column-count layout below (live pages ship this block).
  const stagger = _style?.galleryStagger === true;
  const labels = getGalleryChromeLabelsFrom(puck);
  const list = Array.isArray(images) ? images : [];

  const layers = resolveBannerLayers(backgroundImages);
  const hasBg = layers.length > 0;
  const overlayAlpha = Math.min(100, Math.max(0, overlayOpacity ?? 0)) / 100;
  const sectionStyle = resolveBlockStyle(_style);
  const presetPreview = puck?.metadata?.presetPreview === true;

  if (list.length === 0) {
    return (
      <section
        ref={puck?.dragRef ?? undefined}
        data-block="gallery-masonry"
        data-empty="true"
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: hasBg ? "var(--pf-color-fg)" : "var(--pf-color-bg)",
          minHeight: resolveGalleryMinHeight(minHeight, minHeightValue),
          padding: padVar(GALLERY_PAD_SHORTHAND),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...sectionStyle,
        }}
        {...resolveBlockAttrs(_style)}
      >
        {hasBg && (
          <GalleryBannerLayers layers={layers} bgAnimation={bgAnimation} bgSpeed={bgSpeed} overlayAlpha={overlayAlpha} />
        )}
        {presetPreview ? (
          <PresetMediaPlaceholder kind="masonry" columns={columns} gap={gap} />
        ) : (
          <p
            style={{
              position: "relative",
              zIndex: 1,
              fontFamily: "var(--pf-font-body)",
              color: "var(--pf-color-fg)",
              opacity: 0.45,
              fontSize: "0.9375rem",
              margin: 0,
            }}
          >
            {labels.empty}
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      ref={puck?.dragRef ?? undefined}
      data-block="gallery-masonry"
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: hasBg ? "var(--pf-color-fg)" : "var(--pf-color-bg)",
        minHeight: resolveGalleryMinHeight(minHeight, minHeightValue),
        padding: padVar(GALLERY_PAD_SHORTHAND),
        fontFamily: "var(--pf-font-body)",
        ...sectionStyle,
      }}
      {...resolveBlockAttrs(_style)}
    >
      {hasBg && (
        <GalleryBannerLayers layers={layers} bgAnimation={bgAnimation} bgSpeed={bgSpeed} overlayAlpha={overlayAlpha} />
      )}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "80rem", margin: "0 auto" }}>
        <div
          className="pf-masonry"
          style={
            stagger
              ? { display: "grid", gridTemplateColumns: `repeat(${masonryColsVar(columns)}, minmax(0, 1fr))`, gap: gapValue }
              : { columnCount: masonryColsVar(columns) as unknown as number, columnGap: gapValue }
          }
        >
          {list.map((img, i) => {
            const src = imageDeliveryUrl(img.publicId, {
              width: thumbWidth,
              height: thumbWidth * 2,
              fit: "scale-down",
            });
            if (!src) return null;
            return (
              <figure
                key={img.id}
                style={
                  stagger
                    ? { margin: 0, padding: 0, marginTop: `${galleryStaggerOffsetPx(i, columns)}px` }
                    : { margin: 0, marginBottom: gapValue, padding: 0, breakInside: "avoid" }
                }
              >
                <GalleryLightboxTrigger image={{ id: img.id, publicId: img.publicId, alt: img.alt ?? "" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={img.alt ?? ""}
                    loading="lazy"
                    decoding="async"
                    width={img.width}
                    height={img.height}
                    style={{
                      width: "100%",
                      display: "block",
                      // When both dimensions are known, reserve vertical space via aspect-ratio
                      // so the browser doesn't shift content as the image loads (CLS fix).
                      // When absent (legacy images), fall back to height:auto as before.
                      ...(img.width != null && img.height != null
                        ? { aspectRatio: `${img.width} / ${img.height}` }
                        : { height: "auto" }),
                    }}
                  />
                </GalleryLightboxTrigger>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const galleryMasonryBlockConfig: ComponentConfig<GalleryMasonryProps> = {
  label: "Masonry",
  inline: true,
  defaultProps: galleryMasonryDefaultProps,
  // `images` is intentionally absent from the sidebar fields — the editor drives
  // it via StyleToolkitField (Task 7). Production <Render> reads images straight
  // from saved props; no sidebar field is needed there either.
  // columns/gap are now stored in _style.galleryColumns/_style.galleryGap and edited
  // via the Layout tab GalleryLayoutControls — not as top-level sidebar fields.
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
    } as Field<GalleryMasonryProps["bgAnimation"]>,
    bgSpeed: {
      type: "select",
      label: "BG speed",
      options: [
        { label: "Slow", value: "slow" },
        { label: "Medium", value: "medium" },
        { label: "Fast", value: "fast" },
      ],
    } as Field<GalleryMasonryProps["bgSpeed"]>,
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
  } as unknown as Fields<GalleryMasonryProps>,
  render: GalleryMasonryBlock,
};
