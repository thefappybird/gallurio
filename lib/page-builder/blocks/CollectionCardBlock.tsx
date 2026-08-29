/**
 * CollectionCardBlock — ONE curated gallery collection, placeable anywhere.
 *
 * `FeaturedWork` owns a whole grid: it takes a `FeaturedCollectionRef[]`, lays
 * the tiles out itself at a hardcoded 7/9 crop with the caption always on, and
 * exposes only a column count. That makes the tile un-poachable — a preset
 * cannot sit one collection beside copy, span one across a Columns row, or crop
 * a collection landscape.
 *
 * This block is the same tile with its own aspect-ratio and caption controls.
 * It renders through `FeaturedCollectionsClient` (a single-tile grid) rather
 * than reimplementing the button, so click-to-popup, hover, focus-visible, and
 * the cover/caption markup can never drift from the grid's.
 *
 * Isomorphic and fetch-free like FeaturedWork: `collection` is baked into props
 * by the editor's collection picker, so the same component renders in the editor
 * canvas and on the public page.
 */

import type { ComponentConfig, Field, Fields } from "@measured/puck";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";
import {
  getGalleryChromeLabelsFrom,
  type BlockPuck,
  type CollectionPopupLabels,
} from "@/lib/page-builder/blockContext";
import { FeaturedCollectionsClient } from "./FeaturedCollectionsClient";
import type { FeaturedCollectionRef } from "./FeaturedWorkBlock";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Crop options. "7 / 9" is FeaturedWork's own tile, kept as the default so a
 *  CollectionCard dropped next to a FeaturedWork grid matches it by default. */
export const COLLECTION_CARD_RATIOS = ["7 / 9", "1 / 1", "4 / 5", "3 / 2", "16 / 9"] as const;
export type CollectionCardRatio = (typeof COLLECTION_CARD_RATIOS)[number];

export type CollectionCardProps = {
  _style?: BlockStyle;
  /** The chosen collection. Undefined until the owner picks one. */
  collection?: FeaturedCollectionRef;
  aspectRatio?: CollectionCardRatio;
  showCaption?: boolean;
};

export const collectionCardDefaultProps: CollectionCardProps = {
  collection: undefined,
  aspectRatio: "7 / 9",
  showCaption: true,
};

// ---------------------------------------------------------------------------
// Component (sync — isomorphic)
// ---------------------------------------------------------------------------

export function CollectionCardBlock({
  _style,
  collection,
  aspectRatio,
  showCaption,
  puck,
}: CollectionCardProps & { puck?: BlockPuck }) {
  const ws = puck?.metadata?.workspace;
  const editorPreview = ws?.editorPreview ?? false;
  const labels = getGalleryChromeLabelsFrom(puck);
  const popupLabels = puck?.metadata?.collectionPopupLabels as CollectionPopupLabels | undefined;

  const hasCollection = Boolean(collection?.id);
  const presetPreview = puck?.metadata?.presetPreview === true;
  const previewMinWidth = aspectRatio === "3 / 2" ? "20rem" : aspectRatio === "1 / 1" ? "10rem" : "12rem";

  return (
    <div
      ref={puck?.dragRef ?? undefined}
      data-block="collection-card"
      data-empty={hasCollection ? undefined : "true"}
      style={{
        width: "100%",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      {hasCollection ? (
        <FeaturedCollectionsClient
          tiles={[
            {
              id: collection!.id,
              name: collection!.name,
              count: collection!.itemCount ?? 0,
              coverUrl: imageDeliveryUrl(collection!.coverPublicId, {
                width: 700,
                height: 900,
                fit: "cover",
              }),
            },
          ]}
          columns={1}
          aspectRatio={aspectRatio ?? "7 / 9"}
          showCaption={showCaption !== false}
          mode={editorPreview ? "owner" : "public"}
          slug={ws?.slug}
          popupConfig={ws?.publicPage?.collectionsPopup ?? {}}
          popupLabels={popupLabels}
          brandVars={ws?.brandVars}
        />
      ) : presetPreview ? (
        <div style={{ display: "contents" }}>
          <div
            data-cover-placeholder=""
            data-preset-collection-placeholder="true"
            style={{
              width: "100%",
              // Empty CSS-grid tracks use intrinsic sizing. A contentless 100%
              // child otherwise contributes zero and collapses to a dot in the
              // miniature; size the preview fixture by its intended crop.
              minWidth: previewMinWidth,
              aspectRatio: aspectRatio ?? "7 / 9",
              backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)",
              border: "1px solid color-mix(in srgb, currentColor 28%, transparent)",
            }}
          />
          {showCaption !== false && (
            <div
              data-preset-collection-caption="true"
              style={{
                width: "62%",
                height: "0.55rem",
                marginTop: "0.5rem",
                backgroundColor: "color-mix(in srgb, currentColor 32%, transparent)",
              }}
            />
          )}
        </div>
      ) : (
        <div
          data-cover-placeholder=""
          style={{
            width: "100%",
            aspectRatio: aspectRatio ?? "7 / 9",
            background: "color-mix(in srgb, var(--pf-color-fg) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pf-color-fg) 14%, transparent)",
            display: "grid",
            placeItems: "center",
            color: "var(--pf-color-fg)",
            opacity: 0.45,
            fontSize: "0.9375rem",
            textAlign: "center",
            padding: "1rem",
          }}
        >
          {labels.featuredEmpty}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const collectionCardBlockConfig: ComponentConfig<CollectionCardProps> = {
  label: "Collection card",
  inline: true,
  defaultProps: collectionCardDefaultProps,
  // `collection` is driven by the editor's collection picker on the Content tab,
  // exactly like FeaturedWork's `collections` — no sidebar field on either side.
  fields: {
    _style: productionStyleField,
    aspectRatio: {
      type: "select",
      label: "Crop",
      options: COLLECTION_CARD_RATIOS.map((r) => ({ label: r.replace(/ /g, ""), value: r })),
    } as Field<CollectionCardRatio | undefined>,
    showCaption: {
      type: "radio",
      label: "Caption",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    } as Field<boolean | undefined>,
  } as unknown as Fields<CollectionCardProps>,
  render: CollectionCardBlock,
};
