/**
 * FeaturedWorkBlock — server component spotlighting up to 3 specific gallery
 * items by id, with an optional heading/subheading.
 *
 * Multi-tenant safety: `workspaceId` comes from the server render context.
 * `getItemsByIds` only returns items owned by that workspace, so itemIds that
 * reference another workspace (or no longer exist) are silently dropped.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";
import { getRenderWorkspaceFrom, getGalleryChromeLabelsFrom, type BlockPuck } from "@/lib/page-builder/serverContext";
import { getItemsByIds } from "@/lib/db/queries/gallery";
import {
  resolveBlockStyle,
  asText,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";

// Puck `array` fields persist an array of objects, so `itemIds` round-trips as
// `Array<{ id }>` from the editor. Tests/fixtures may pass a plain `string[]`.
// `normalizeItemIds` accepts both shapes.
export type FeaturedWorkItemId = string | { id?: string | null };

export type FeaturedWorkProps = {
  _style?: BlockStyle;
  heading: string;
  subheading: string;
  itemIds: FeaturedWorkItemId[];
  layout: "row" | "stagger";
};

function normalizeItemIds(itemIds: FeaturedWorkItemId[]): string[] {
  return (Array.isArray(itemIds) ? itemIds : [])
    .map((x) => (typeof x === "string" ? x : x?.id))
    .filter((x): x is string => typeof x === "string" && x.length > 0);
}

export const featuredWorkDefaultProps: FeaturedWorkProps = {
  heading: "Featured work",
  subheading: "",
  itemIds: [],
  layout: "row",
};

const MAX_FEATURED = 3;

export async function FeaturedWorkBlock({
  _style,
  heading,
  subheading,
  itemIds,
  layout,
  puck,
}: FeaturedWorkProps & { puck?: BlockPuck }) {
  const workspace = getRenderWorkspaceFrom(puck);

  let items: Awaited<ReturnType<typeof getItemsByIds>> = [];
  if (workspace && String(workspace._id)) {
    const ids = normalizeItemIds(itemIds).slice(0, MAX_FEATURED);
    if (ids.length > 0) {
      try {
        items = await getItemsByIds({ workspaceId: String(workspace._id), itemIds: ids });
      } catch (err) {
        console.error("FeaturedWorkBlock query failed", {
          workspaceId: String(workspace._id),
          itemIds: ids,
          err,
        });
        items = [];
      }
    }
  }

  const labels = getGalleryChromeLabelsFrom(puck);
  const headingText = asText(heading);
  const subheadingText = asText(subheading);

  return (
    <section
      data-block="featured-work"
      data-empty={items.length === 0 ? "true" : undefined}
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
    >
      {/* Mobile-first: stack to a single column below 640px. */}
      <style>{`
        @media (max-width: 639px) { .pf-featured-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        {headingText && (
          <h2
            style={{
              fontFamily: "var(--pf-font-heading)",
              color: "var(--pf-color-fg)",
              fontSize: "1.875rem",
              fontWeight: 700,
              margin: 0,
              textAlign: "center",
            }}
          >
            {headingText}
          </h2>
        )}
        {subheadingText && (
          <p
            style={{
              color: "var(--pf-color-fg)",
              opacity: 0.7,
              textAlign: "center",
              margin: "0.5rem 0 0",
              fontSize: "1.0625rem",
            }}
          >
            {subheadingText}
          </p>
        )}

        {items.length === 0 ? (
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
          <div
            className="pf-featured-grid"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${items.length}, 1fr)`,
              gap: "1.5rem",
              marginTop: headingText || subheadingText ? "2.5rem" : 0,
              alignItems: "start",
            }}
          >
            {items.map((item, i) => {
              const src =
                cloudinaryThumbnailUrl(item.cloudinaryPublicId, {
                  width: 700,
                  height: 900,
                  crop: "fill",
                }) || item.url;
              const alt = item.altText || item.caption || "";
              const staggerOffset =
                layout === "stagger" && i % 2 === 1 ? "2.5rem" : "0";
              return (
                <figure
                  key={String(item._id)}
                  style={{ margin: 0, padding: 0, marginTop: staggerOffset }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: "100%",
                      aspectRatio: "7 / 9",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {item.caption && (
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
        )}
      </div>
    </section>
  );
}

export const featuredWorkBlockConfig: ComponentConfig<FeaturedWorkProps> = {
  label: "Featured Work",
  defaultProps: featuredWorkDefaultProps,
  fields: {
    _style: productionStyleField,
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Sub-heading" },
    itemIds: {
      type: "array",
      label: "Gallery item IDs (max 3)",
      // Puck persists each row as `{ id }`; the component's normalizeItemIds
      // flattens these objects back to id strings at render time.
      arrayFields: {
        id: { type: "text", label: "Item ID" },
      },
    } as unknown as Field<FeaturedWorkItemId[]>,
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Row", value: "row" },
        { label: "Stagger", value: "stagger" },
      ],
    },
  },
  // Async server component — Puck's PuckComponent type expects sync JSX.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: FeaturedWorkBlock as any,
};
