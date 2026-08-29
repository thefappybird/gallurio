import type { GalleryColumns, GalleryGap } from "@/lib/page-builder/styleToolkit";
import { gridColsVar, masonryColsVar } from "@/lib/page-builder/responsive";

const GAP_PX: Record<GalleryGap, string> = {
  tight: "4px",
  normal: "8px",
  loose: "16px",
};

const MASONRY_RATIOS = [
  "4 / 5",
  "1 / 1",
  "3 / 4",
  "1 / 1",
  "4 / 5",
  "3 / 4",
  "1 / 1",
  "4 / 5",
] as const;

/**
 * Decorative sample media used only by the preset hover card. Empty galleries
 * must stay empty on the real canvas, but an insertion preview still needs to
 * communicate the layout the owner is choosing between.
 */
export function PresetMediaPlaceholder({
  kind,
  columns,
  gap,
}: {
  kind: "grid" | "masonry" | "collections";
  columns: GalleryColumns;
  gap: GalleryGap;
}) {
  const count = kind === "collections" ? 3 : columns * 2;
  const gapValue = GAP_PX[gap];
  const tileStyle = {
    border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
    backgroundColor: "color-mix(in srgb, currentColor 8%, transparent)",
  } as const;

  if (kind === "masonry") {
    return (
      <div
        data-preset-media-placeholder="masonry"
        style={{ width: "100%", columnCount: masonryColsVar(columns) as unknown as number, columnGap: gapValue }}
      >
        {MASONRY_RATIOS.slice(0, count).map((aspectRatio, index) => (
          <div
            key={index}
            data-preset-media-tile="true"
            style={{ ...tileStyle, aspectRatio, breakInside: "avoid", marginBottom: gapValue }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-preset-media-placeholder={kind}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: gridColsVar(`repeat(${columns}, 1fr)`),
        gap: gapValue,
      }}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} data-preset-media-tile="true">
          <div style={{ ...tileStyle, aspectRatio: kind === "collections" ? "4 / 3" : "3 / 2" }} />
          {kind === "collections" && (
            <div
              style={{
                width: index === 1 ? "54%" : "66%",
                height: "0.55rem",
                marginTop: "0.5rem",
                backgroundColor: "color-mix(in srgb, currentColor 26%, transparent)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
