/** Locked structural content slot between portfolio Navigation and Footer. */
import type { ComponentConfig, Field, Slot, SlotComponent } from "@measured/puck";
import type { BlockPuck } from "@/lib/page-builder/serverContext";
import type { CssLength } from "@/lib/page-builder/styleToolkit";

export const PAGE_BODY_MARGIN_X_DEFAULT: CssLength = "1.5rem";

export type PageBodyBlockProps = {
  /** Horizontal inset shared by all ordinary page content. */
  marginX?: CssLength;
  content: Slot;
};

export const pageBodyDefaultProps: PageBodyBlockProps = {
  marginX: PAGE_BODY_MARGIN_X_DEFAULT,
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
        height: "100%",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {Content({
        style: {
          boxSizing: "border-box",
          display: "flex",
          flex: "1 1 auto",
          flexDirection: "column",
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
