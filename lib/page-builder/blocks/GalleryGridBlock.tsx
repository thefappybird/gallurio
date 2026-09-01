/**
 * GalleryGridBlock — ISOMORPHIC (client-safe) responsive thumbnail grid.
 *
 * Renders purely from its own `images[]` prop (baked by the editor's multi-image
 * picker and refreshed by reconcileGalleryImages on editor-load / publish). No DB
 * access, no server context, no server-only imports — so the SAME
 * component renders in the editor canvas AND on the public page (WYSIWYG,
 * fetch-free).
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig, Field, Fields, Slot, SlotComponent } from "@measured/puck";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
  type GalleryColumns,
  type GalleryGap,
} from "@/lib/page-builder/styleToolkit";
import {
  getGalleryChromeLabelsFrom,
  type BlockPuck,
} from "@/lib/page-builder/blockContext";
import { GALLERY_PAD_SHORTHAND, padVar, gridColsVar } from "@/lib/page-builder/responsive";
import { resolveGalleryMinHeight } from "./bannerLayers";
import { GalleryLightboxTrigger } from "./GalleryLightboxTrigger";
import { PresetMediaPlaceholder } from "./PresetMediaPlaceholder";
import type { ContainerHeight } from "./manualBlocks";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type GalleryImage = {
  id: string;
  publicId: string;
  alt?: string;
  /** Natural pixel width — persisted from upload; enables browser space reservation to prevent CLS. */
  width?: number;
  /** Natural pixel height — persisted from upload; enables browser space reservation to prevent CLS. */
  height?: number;
};

export type GalleryGridProps = {
  _style?: BlockStyle;
  /** New composition path: individual Image blocks live in this slot, so they
   * can be selected, styled, and reordered by Puck. */
  content?: Slot;
  /** @deprecated Read-only compatibility for pages saved before gallery slots.
   * New grids use `content` Image blocks instead. */
  images: GalleryImage[];
  minHeight?: ContainerHeight;
  /** CSS length value when minHeight === "custom", e.g. "400px" or "50vh". */
  minHeightValue?: string;
};

export const galleryGridDefaultProps: GalleryGridProps = {
  content: [],
  images: [],
};

const GAP_MAP: Record<GalleryGap, string> = {
  tight: "4px",
  normal: "8px",
  loose: "16px",
};

const THUMB_WIDTH_MAP: Record<GalleryColumns, number> = {
  2: 800,
  3: 600,
  4: 400,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GalleryGridBlock({
  _style,
  images,
  minHeight,
  minHeightValue,
  content: Content,
  puck,
}: Omit<GalleryGridProps, "content"> & { content?: Slot | SlotComponent; puck?: BlockPuck }) {
  const columns = _style?.galleryColumns ?? 3;
  const gap = _style?.galleryGap ?? "normal";
  const gapValue = GAP_MAP[gap] ?? "8px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  const list = Array.isArray(images) ? images : [];

  const sectionStyle = resolveBlockStyle(_style);
  const presetPreview = puck?.metadata?.presetPreview === true;
  const editorGridColumns = puck?.isEditing
    ? `repeat(${columns}, minmax(0, 1fr))`
    : gridColsVar(`repeat(${columns}, 1fr)`);

  // Legacy image arrays remain authoritative when present so old published
  // pages keep their exact visuals. New blocks have an empty array and render
  // the Puck slot of regular Image blocks instead.
  const useLegacyImages = list.length > 0;
  const SlotContent = typeof Content === "function" ? Content : undefined;

  if (!useLegacyImages && !SlotContent) {
    return (
      <section
        ref={puck?.dragRef ?? undefined}
        data-block="gallery-grid"
        data-empty="true"
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: "var(--pf-color-bg)",
          minHeight: resolveGalleryMinHeight(minHeight, minHeightValue),
          padding: padVar(GALLERY_PAD_SHORTHAND),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...sectionStyle,
        }}
        {...resolveBlockAttrs(_style)}
      >
        {presetPreview ? (
          <PresetMediaPlaceholder kind="grid" columns={columns} gap={gap} />
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
            {getGalleryChromeLabelsFrom(puck).empty}
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      ref={puck?.dragRef ?? undefined}
      data-block="gallery-grid"
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: "var(--pf-color-bg)",
        minHeight: resolveGalleryMinHeight(minHeight, minHeightValue),
        padding: padVar(GALLERY_PAD_SHORTHAND),
        fontFamily: "var(--pf-font-body)",
        ...sectionStyle,
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ position: "relative", zIndex: 1, maxWidth: "80rem", margin: "0 auto" }}>
        {useLegacyImages ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: editorGridColumns,
              gap: gapValue,
            }}
          >
            {list.map((img) => {
            const src = imageDeliveryUrl(img.publicId, {
              width: thumbWidth,
              height: thumbWidth,
              fit: "cover",
            });
            // Skip a blank publicId / unset cloud name rather than emit a broken <img src="">.
            if (!src) return null;
            return (
              <figure key={img.id} style={{ margin: 0, padding: 0 }}>
                <GalleryLightboxTrigger image={{ id: img.id, publicId: img.publicId, alt: img.alt ?? "" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={img.alt ?? ""}
                    loading="lazy"
                    width={img.width}
                    height={img.height}
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                  />
                </GalleryLightboxTrigger>
              </figure>
            );
            })}
          </div>
        ) : (
          SlotContent?.({
            className: "pf-gallery-grid-slot",
            style: {
              display: "grid",
              gridTemplateColumns: editorGridColumns,
              gap: gapValue,
            },
          })
        )}
      </div>
    </section>
  );
}

export const galleryGridBlockConfig: ComponentConfig<GalleryGridProps> = {
  label: "Photo Grid",
  inline: true,
  defaultProps: galleryGridDefaultProps,
  // `images` is intentionally absent from the sidebar fields — the editor drives
  // it via StyleToolkitField (Task 7). Production <Render> reads images straight
  // from saved props; no sidebar field is needed there either.
  // columns/gap are now stored in _style.galleryColumns/_style.galleryGap and edited
  // via the Layout tab GalleryLayoutControls — not as top-level sidebar fields.
  // Banner fields are managed by StyleToolkitField and stripped by resolveFields in editorConfig.
  fields: {
    _style: productionStyleField,
    content: { type: "slot", allow: ["Image"] },
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
  } as unknown as Fields<GalleryGridProps>,
  render: GalleryGridBlock,
};
