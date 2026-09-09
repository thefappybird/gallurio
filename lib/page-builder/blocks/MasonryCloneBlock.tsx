import type { ComponentConfig } from "@measured/puck";
import type { BlockPuck } from "../blockContext";
import { MasonryCloneClient } from "./MasonryCloneClient";

export type MasonryCloneProps = {
  masonryId: string;
  column: number;
  gap: number;
  sourceId: string;
  imageProps: Record<string, unknown>;
  layoutSignature: string;
};

export const masonryCloneDefaultProps: MasonryCloneProps = {
  masonryId: "",
  column: 1,
  gap: 12,
  sourceId: "",
  imageProps: { alt: "" },
  layoutSignature: "",
};

export function MasonryCloneBlock(props: MasonryCloneProps & { id?: string; puck?: BlockPuck }) {
  return <MasonryCloneClient {...props} />;
}

export const masonryCloneBlockConfig: ComponentConfig<MasonryCloneProps> = {
  label: "MasonryClone",
  inline: true,
  defaultProps: masonryCloneDefaultProps,
  fields: {} as ComponentConfig<MasonryCloneProps>["fields"],
  permissions: { drag: false, delete: false, duplicate: false, insert: false, edit: false },
  render: MasonryCloneBlock as ComponentConfig<MasonryCloneProps>["render"],
};
