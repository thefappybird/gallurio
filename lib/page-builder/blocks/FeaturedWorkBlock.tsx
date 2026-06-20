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
} from "@/lib/page-builder/styleToolkit";
import {
  getGalleryChromeLabelsFrom,
  type BlockPuck,
} from "@/lib/page-builder/blockContext";
import { FeaturedCollectionsClient } from "./FeaturedCollectionsClient";
import { padVar } from "@/lib/page-builder/responsive";

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
  columns: 2 | 3 | 4;
};

export const featuredWorkDefaultProps: FeaturedWorkProps = {
  collections: [],
  columns: 3,
};

// ---------------------------------------------------------------------------
// Component (sync — isomorphic)
// ---------------------------------------------------------------------------

export function FeaturedWorkBlock({
  _style,
  collections,
  columns,
  puck,
}: FeaturedWorkProps & { puck?: BlockPuck }) {
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

  return (
    <section
      data-block="featured-work"
      data-empty={list.length === 0 ? "true" : undefined}
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: padVar("4rem 1.5rem"),
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
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
  defaultProps: featuredWorkDefaultProps,
  // `collections` is intentionally absent from the sidebar fields — the editor drives
  // it via StyleToolkitField Content tab. Production <Render> reads collections straight
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
  } as unknown as Fields<FeaturedWorkProps>,
  render: FeaturedWorkBlock,
};
