/** Locked structural content slot between portfolio Navigation and Footer. */
import type { ComponentConfig, Field, Slot, SlotComponent } from "@measured/puck";
import type { CSSProperties } from "react";
import type { BlockPuck } from "@/lib/page-builder/serverContext";
import {
  resolveBlockStyle,
  colorTokenToVar,
  productionStyleField,
  STYLE_COLOR_TOKENS,
  type BlockStyle,
  type CssLength,
  type StyleColorToken,
} from "@/lib/page-builder/styleToolkit";
import { cfImageUrl } from "./manualBlocks";
import type { GalleryImage } from "./GalleryGridBlock";
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";

export const PAGE_BODY_MARGIN_X_DEFAULT: CssLength = "1.5rem";
export const PAGE_BODY_SLOT_CLASS = "pf-page-body-slot";

/** Future-only defaults materialized when a Container is inserted in this body. */
export type PageBodyContainerDefaults = {
  radius?: number;
  paddingTop?: CssLength;
  paddingRight?: CssLength;
  paddingBottom?: CssLength;
  paddingLeft?: CssLength;
  marginTop?: CssLength;
  marginRight?: CssLength;
  marginBottom?: CssLength;
  marginLeft?: CssLength;
  /** @deprecated Kept only to read drafts saved during the initial rollout. */
  padding?: CssLength;
  /** @deprecated Kept only to read drafts saved during the initial rollout. */
  margin?: CssLength;
  gap?: number;
  overallWidth?: "page-fit" | "full";
};

export type PageBodyBlockProps = {
  _style?: BlockStyle;
  /** Same background-image/overlay banner as Container/Columns, but spans the
   *  WHOLE page body edge-to-edge — rendered on the outer wrapper, behind the
   *  margin gutters, not just the padded content slot. */
  backgroundImages?: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayOpacity?: number;
  overlayColorToken?: StyleColorToken;
  /** Horizontal inset shared by all ordinary page content. */
  marginX?: CssLength;
  /** Defaults for new descendant Containers. Existing blocks are never changed. */
  containerDefaults?: PageBodyContainerDefaults;
  content: Slot;
};

export const pageBodyDefaultProps: PageBodyBlockProps = {
  // The page margin (marginX) is meant to be the ONLY horizontal inset — a
  // direct child duplicating it with its own x-axis padding just doubles the
  // gutter. Still just a starting default: editable per-block afterward like
  // every other containerDefaults field, and never retrofitted onto existing
  // content (see applyPageBodyContainerDefaults's doc comment).
  containerDefaults: { paddingLeft: "0px", paddingRight: "0px" },
  backgroundImages: [],
  bgAnimation: "crossfade",
  bgSpeed: "medium",
  overlayOpacity: 0,
  content: [],
};

export function PageBodyBlock({
  _style,
  backgroundImages,
  bgAnimation,
  bgSpeed,
  overlayOpacity,
  overlayColorToken,
  marginX,
  content: Content,
  puck,
}: Omit<PageBodyBlockProps, "content"> & { content: SlotComponent; puck?: BlockPuck }) {
  const horizontalMargin = marginX ?? PAGE_BODY_MARGIN_X_DEFAULT;

  // Same baked-background resolution as Container/Columns — see those for the
  // shared shape (single <img> for one image, slideshow island for 2+).
  const layers = (Array.isArray(backgroundImages) ? backgroundImages : [])
    .map((img) => ({ id: img.id, src: cfImageUrl(img.publicId, 2000) }))
    .filter((l): l is { id: string; src: string } => Boolean(l.src));
  const hasBg = layers.length > 0;
  const overlayPercent = Math.min(100, Math.max(0, overlayOpacity ?? 0));
  const overlayAlpha = overlayPercent / 100;
  const scrimColor =
    overlayColorToken && (STYLE_COLOR_TOKENS as readonly string[]).includes(overlayColorToken)
      ? `color-mix(in srgb, ${colorTokenToVar(overlayColorToken)} ${overlayPercent}%, transparent)`
      : `rgba(0,0,0,${overlayAlpha})`;
  const bgImageAlpha = Math.min(100, Math.max(0, _style?.bgImageOpacity ?? 100)) / 100;
  const sectionStyle = resolveBlockStyle(_style);

  return (
    <main
      ref={puck?.dragRef ?? undefined}
      data-block="page-body"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        // Take the space Navigation and Footer leave, never a fixed share of the
        // page. `height: 100%` looked equivalent but resolved against the element
        // holding all THREE blocks, so the body claimed the full page height and
        // pushed the footer down by the height of the chrome — dead space above
        // the footer on every page whose content did not happen to fill it.
        // PF_PAGE_FRAME_CSS makes that holder the flex column this grows inside.
        flex: "1 1 auto",
        minWidth: 0,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        backgroundColor: hasBg ? "var(--pf-color-fg)" : undefined,
        ...sectionStyle,
        // A direct full-width Container uses this to offset only the PageBody
        // inset. Nested Containers never see the page-body slot selector.
        "--pf-page-body-margin-x": horizontalMargin,
      } as CSSProperties}
    >
      {/* Banner spans the WHOLE body (edge-to-edge, behind the margin gutters
          too) — rendered here on the outer wrapper, not the padded slot. */}
      {hasBg && overlayAlpha > 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1, backgroundColor: scrimColor }} />
      )}
      {hasBg && (
        <div data-bg-opacity-layer aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: bgImageAlpha }}>
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
        </div>
      )}
      <style>{`
        .${PAGE_BODY_SLOT_CLASS} > [data-pf-full-width] {
          width: calc(100% + var(--pf-page-body-margin-x) + var(--pf-page-body-margin-x)) !important;
          margin-left: calc(0px - var(--pf-page-body-margin-x)) !important;
          margin-right: calc(0px - var(--pf-page-body-margin-x)) !important;
        }
      `}</style>
      {Content({
        className: PAGE_BODY_SLOT_CLASS,
        style: {
          boxSizing: "border-box",
          position: "relative",
          zIndex: 1,
          // Block flow, NOT flex: the slot stretches to fill the body row (so the
          // whole gap between Navigation and Footer stays droppable), but its
          // children lay out like the page canvas -- each block keeps its own
          // height. As a flex column this wrapper turned every child into a flex
          // item, and Container's `flexGrow: 1` then stretched a single dropped
          // section (and its background) over the entire vacant row.
          display: "block",
          flex: "1 1 auto",
          width: "100%",
          minWidth: 0,
          minHeight: 0,
          paddingLeft: horizontalMargin,
          paddingRight: horizontalMargin,
        },
        ...(puck?.isEditing ? { minEmptyHeight: 320 } : {}),
      })}
    </main>
  );
}

/** The body is editable only for its margin; its slot children remain editable. */
export const pageBodyPermissions: ComponentConfig<PageBodyBlockProps>["permissions"] = {
  delete: false,
  duplicate: false,
  drag: false,
};

export const pageBodyFields = {
  // Inert placeholder in production — StyleToolkitField only renders in the
  // editor bundle (see editorConfig.tsx's `pageBody` for the real fields).
  _style: productionStyleField,
  bgAnimation: {
    type: "select",
    label: "Background animation",
    options: [
      { label: "Crossfade", value: "crossfade" },
      { label: "Ken Burns", value: "kenburns" },
      { label: "Slide", value: "slide" },
    ],
  } as Field<PageBodyBlockProps["bgAnimation"]>,
  bgSpeed: {
    type: "select",
    label: "Animation speed",
    options: [
      { label: "Slow (7s)", value: "slow" },
      { label: "Medium (5s)", value: "medium" },
      { label: "Fast (3s)", value: "fast" },
    ],
  } as Field<PageBodyBlockProps["bgSpeed"]>,
  overlayOpacity: { type: "number", label: "Overlay opacity (0-100)", min: 0, max: 100 } as Field<number | undefined>,
  overlayColorToken: {
    type: "select",
    label: "Overlay color",
    options: [
      { label: "None (black)", value: "" },
      { label: "Primary", value: "primary" },
      { label: "Secondary", value: "secondary" },
      { label: "Accent", value: "accent" },
      { label: "Background", value: "background" },
      { label: "Foreground", value: "foreground" },
    ],
  } as unknown as Field<StyleColorToken | undefined>,
  marginX: { type: "text", label: "Horizontal page margin" } as Field<CssLength | undefined>,
  // Puck's shared <Render> walks object fields even outside the editor. Keep
  // the complete nested schema here; omitting objectFields lets the editor
  // appear to work but crashes preview/publish while resolving this prop.
  containerDefaults: {
    type: "object",
    label: "New container defaults",
    objectFields: {
      radius: { type: "number" },
      paddingTop: { type: "text" },
      paddingRight: { type: "text" },
      paddingBottom: { type: "text" },
      paddingLeft: { type: "text" },
      marginTop: { type: "text" },
      marginRight: { type: "text" },
      marginBottom: { type: "text" },
      marginLeft: { type: "text" },
      // Compatibility for defaults written during the short initial rollout.
      padding: { type: "text" },
      margin: { type: "text" },
      gap: { type: "number" },
      overallWidth: {
        type: "select",
        options: [
          { label: "Page fit", value: "page-fit" },
          { label: "Full", value: "full" },
        ],
      },
    },
  } as Field<PageBodyContainerDefaults | undefined>,
  content: { type: "slot" },
} as unknown as ComponentConfig<PageBodyBlockProps>["fields"];

export const pageBodyBlockConfig: ComponentConfig<PageBodyBlockProps> = {
  label: "Page body",
  inline: true,
  defaultProps: pageBodyDefaultProps,
  fields: pageBodyFields,
  permissions: pageBodyPermissions,
  render: PageBodyBlock,
};
