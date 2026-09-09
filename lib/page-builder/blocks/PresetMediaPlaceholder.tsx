import type { CSSProperties } from "react";

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

export const PRESET_MEDIA_SURFACE =
  "color-mix(in srgb, var(--pf-color-fg) 16%, var(--pf-color-bg))";
export const PRESET_MEDIA_STRONG =
  "color-mix(in srgb, var(--pf-color-fg) 30%, var(--pf-color-bg))";
export const PRESET_MEDIA_ACCENT =
  "color-mix(in srgb, var(--pf-color-accent) 55%, var(--pf-color-bg))";
export const PRESET_MEDIA_BORDER =
  "color-mix(in srgb, var(--pf-color-fg) 34%, var(--pf-color-bg))";

/** Flat theme-aware stand-in that communicates an image's crop and weight. */
export function PresetPhotoTile({
  aspectRatio,
  index = 0,
  fill = false,
}: {
  aspectRatio?: string;
  index?: number;
  fill?: boolean;
}) {
  const position = fill
    ? ({ position: "absolute", inset: 0 } as const)
    : ({ position: "relative" } as const);

  return (
    <div
      aria-hidden="true"
      data-preset-photo-tile="true"
      style={{
        ...position,
        width: "100%",
        height: fill ? "100%" : undefined,
        aspectRatio: fill ? undefined : aspectRatio,
        overflow: "hidden",
        border: `1px solid ${PRESET_MEDIA_BORDER}`,
        backgroundColor: PRESET_MEDIA_SURFACE,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: index % 2 === 0 ? "24%" : "18%",
          aspectRatio: "1",
          borderRadius: "50%",
          insetInlineEnd: "10%",
          top: "12%",
          backgroundColor: PRESET_MEDIA_ACCENT,
        }}
      />
      <div
        style={{
          position: "absolute",
          insetInlineStart: index % 3 === 0 ? "0" : "16%",
          insetInlineEnd: "0",
          bottom: "0",
          height: index % 2 === 0 ? "42%" : "34%",
          backgroundColor: PRESET_MEDIA_STRONG,
        }}
      />
      <div
        style={{
          position: "absolute",
          insetInlineStart: "0",
          bottom: "0",
          width: index % 2 === 0 ? "48%" : "58%",
          height: index % 2 === 0 ? "24%" : "30%",
          backgroundColor: PRESET_MEDIA_ACCENT,
        }}
      />
    </div>
  );
}

type PresetMediaPlaceholderProps = {
  kind: "grid" | "masonry" | "collections" | "image" | "video" | "background";
  columns?: GalleryColumns;
  gap?: GalleryGap;
  aspectRatio?: string;
};

/** Decorative media used only by the insertion hover card. */
export function PresetMediaPlaceholder({
  kind,
  columns = 3,
  gap = "normal",
  aspectRatio,
}: PresetMediaPlaceholderProps) {
  if (kind === "image" || kind === "background") {
    return (
      <div
        data-preset-media-placeholder={kind}
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      >
        <PresetPhotoTile fill index={kind === "background" ? 2 : 0} />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div
        data-preset-media-placeholder="video"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: aspectRatio ?? "16 / 9",
          overflow: "hidden",
          border: `1px solid ${PRESET_MEDIA_BORDER}`,
          backgroundColor: PRESET_MEDIA_STRONG,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "4.5rem",
            aspectRatio: "1",
            borderRadius: "50%",
            border: `2px solid ${PRESET_MEDIA_BORDER}`,
            backgroundColor: PRESET_MEDIA_SURFACE,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            style={{
              width: 0,
              height: 0,
              marginInlineStart: "0.3rem",
              borderTop: "0.75rem solid transparent",
              borderBottom: "0.75rem solid transparent",
              borderInlineStart: "1.1rem solid var(--pf-color-accent)",
            }}
          />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            insetInlineStart: "4%",
            insetInlineEnd: "4%",
            bottom: "6%",
            height: "0.35rem",
            backgroundColor: PRESET_MEDIA_ACCENT,
          }}
        />
      </div>
    );
  }

  const count = kind === "collections" ? 3 : columns * 2;
  const gapValue = GAP_PX[gap];

  if (kind === "masonry") {
    return (
      <div
        data-preset-media-placeholder="masonry"
        style={{
          width: "100%",
          columnCount: masonryColsVar(columns) as unknown as number,
          columnGap: gapValue,
        }}
      >
        {MASONRY_RATIOS.slice(0, count).map((ratio, index) => (
          <div
            key={index}
            data-preset-media-tile="true"
            style={{ breakInside: "avoid", marginBottom: gapValue }}
          >
            <PresetPhotoTile aspectRatio={ratio} index={index} />
          </div>
        ))}
      </div>
    );
  }

  const gridStyle: CSSProperties = {
    width: "100%",
    display: "grid",
    gridTemplateColumns: gridColsVar(`repeat(${columns}, 1fr)`),
    gap: gapValue,
  };

  return (
    <div data-preset-media-placeholder={kind} style={gridStyle}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} data-preset-media-tile="true">
          <PresetPhotoTile
            aspectRatio={kind === "collections" ? "4 / 3" : "3 / 2"}
            index={index}
          />
          {kind === "collections" && (
            <div
              style={{
                width: index === 1 ? "54%" : "66%",
                height: "0.55rem",
                marginTop: "0.5rem",
                backgroundColor: PRESET_MEDIA_STRONG,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
