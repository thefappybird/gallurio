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
import { getRenderWorkspace } from "@/lib/page-builder/serverContext";
import { getItemsByIds } from "@/lib/db/queries/gallery";

export type FeaturedWorkProps = {
  heading: string;
  subheading: string;
  itemIds: string[];
  layout: "row" | "stagger";
};

export const featuredWorkDefaultProps: FeaturedWorkProps = {
  heading: "Featured work",
  subheading: "",
  itemIds: [],
  layout: "row",
};

const MAX_FEATURED = 3;

export async function FeaturedWorkBlock({
  heading,
  subheading,
  itemIds,
  layout,
}: FeaturedWorkProps) {
  const workspace = getRenderWorkspace();

  let items: Awaited<ReturnType<typeof getItemsByIds>> = [];
  if (workspace && String(workspace._id)) {
    const ids = (Array.isArray(itemIds) ? itemIds : []).slice(0, MAX_FEATURED);
    if (ids.length > 0) {
      try {
        items = await getItemsByIds({ workspaceId: String(workspace._id), itemIds: ids });
      } catch (err) {
        console.error("FeaturedWorkBlock query failed", err);
        items = [];
      }
    }
  }

  return (
    <section
      data-block="featured-work"
      data-empty={items.length === 0 ? "true" : undefined}
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
      }}
    >
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        {heading && (
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
            {heading}
          </h2>
        )}
        {subheading && (
          <p
            style={{
              color: "var(--pf-color-fg)",
              opacity: 0.7,
              textAlign: "center",
              margin: "0.5rem 0 0",
              fontSize: "1.0625rem",
            }}
          >
            {subheading}
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
            No featured photos selected yet.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${items.length}, 1fr)`,
              gap: "1.5rem",
              marginTop: heading || subheading ? "2.5rem" : 0,
              alignItems: "start",
            }}
          >
            {items.map((item, i) => {
              const src = cloudinaryThumbnailUrl(item.cloudinaryPublicId, {
                width: 700,
                height: 900,
                crop: "fill",
              });
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
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Subheading" },
    itemIds: {
      type: "array",
      label: "Gallery item IDs (max 3)",
      arrayFields: {
        // Each entry is a plain item-id string.
        id: { type: "text", label: "Item ID" },
      },
      // Stored as string[]; Puck array fields hold objects, so we expose a
      // single text field per row and map at the edges. See getArrayItemLabel.
    } as unknown as Field<string[]>,
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
