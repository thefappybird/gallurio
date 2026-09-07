/** Locked structural content slot between portfolio Navigation and Footer. */
import type { ComponentConfig, Field, Slot, SlotComponent } from "@measured/puck";
import type { CSSProperties } from "react";
import type { BlockPuck } from "@/lib/page-builder/serverContext";
import type { CssLength } from "@/lib/page-builder/styleToolkit";

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
  /** Horizontal inset shared by all ordinary page content. */
  marginX?: CssLength;
  /** Defaults for new descendant Containers. Existing blocks are never changed. */
  containerDefaults?: PageBodyContainerDefaults;
  content: Slot;
};

export const pageBodyDefaultProps: PageBodyBlockProps = {
  content: [],
};

export function PageBodyBlock({
  marginX,
  content: Content,
  puck,
}: Omit<PageBodyBlockProps, "content"> & { content: SlotComponent; puck?: BlockPuck }) {
  const horizontalMargin = marginX ?? PAGE_BODY_MARGIN_X_DEFAULT;
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
        // A direct full-width Container uses this to offset only the PageBody
        // inset. Nested Containers never see the page-body slot selector.
        "--pf-page-body-margin-x": horizontalMargin,
      } as CSSProperties}
    >
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
