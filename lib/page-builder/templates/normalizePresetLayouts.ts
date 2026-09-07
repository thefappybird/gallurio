import { mapBlocks } from "@/lib/page-builder/blockTree";
import type { PuckBlockEntry, PuckData, PortfolioPuckData } from "@/lib/page-builder/types";

type BlockProps = Record<string, unknown>;
type BlockList = PuckBlockEntry[];

const DIVIDER_GROUP_PRESETS = new Set([
  "CtaMinimalPreset",
  "GalleryLandingMastheadPreset",
  "FooterStatementPreset",
]);

function childrenOf(props: BlockProps): BlockList {
  return Array.isArray(props.content) ? props.content as BlockList : [];
}

function isContainer(block: PuckBlockEntry | undefined, overallWidth: "page-fit" | "full") {
  return block?.type === "Container" && block.props.overallWidth === overallWidth;
}

function zeroPaddingLayout(gap: unknown): BlockProps {
  return {
    ...(gap !== undefined ? { gap } : {}),
    paddingTop: "0px",
    paddingRight: "0px",
    paddingBottom: "0px",
    paddingLeft: "0px",
    marginBottom: "0px",
  };
}

function pageFitGroup(blocks: BlockList, props: BlockProps): PuckBlockEntry {
  return {
    type: "Container",
    props: {
      overallWidth: "page-fit",
      ...(props.alignX !== undefined ? { alignX: props.alignX } : {}),
      ...(props.alignY !== undefined ? { alignY: props.alignY } : {}),
      _style: zeroPaddingLayout((props._style as BlockProps | undefined)?.gap),
      content: blocks,
    },
  };
}

function unwrapPageFitColumns(block: PuckBlockEntry): PuckBlockEntry {
  const props = block.props as BlockProps;
  const content = childrenOf(props);
  if (
    block.type === "Container" && props.overallWidth === "page-fit" && content.length === 1
    && content[0]?.type === "Columns" && content[0].props.overallWidth === "full"
  ) {
    return content[0];
  }
  return block;
}

function unwrappedPageFitShell(content: BlockList): BlockList {
  if (content.length !== 1 || !isContainer(content[0], "page-fit")) return content;
  return childrenOf(content[0].props as BlockProps);
}

function normalizeDividerGroups(block: PuckBlockEntry): PuckBlockEntry {
  const props = block.props as BlockProps;
  const storedContent = childrenOf(props);
  if (
    props.overallWidth === "full" && storedContent.some((child) => child.type === "Divider")
    && storedContent.every((child) => child.type === "Divider" || isContainer(child, "page-fit"))
  ) return block;

  const content = unwrappedPageFitShell(storedContent).map(unwrapPageFitColumns);
  if (!content.some((child) => child.type === "Divider")) return block;

  const grouped: BlockList = [];
  let group: BlockList = [];
  const flush = () => {
    if (group.length) grouped.push(pageFitGroup(group, props));
    group = [];
  };
  for (const child of content) {
    if (child.type === "Divider") {
      flush();
      grouped.push(child);
    } else {
      group.push(child);
    }
  }
  flush();

  return { ...block, props: { ...props, overallWidth: "full", content: grouped } };
}

function findNested(blocks: BlockList, type: string): PuckBlockEntry | undefined {
  for (const block of blocks) {
    if (block.type === type) return block;
    const found = findNested(childrenOf(block.props as BlockProps), type);
    if (found) return found;
  }
  return undefined;
}

function normalizeDirectoryFooter(block: PuckBlockEntry): PuckBlockEntry {
  const props = block.props as BlockProps;
  const content = childrenOf(props);
  if (
    props.overallWidth === "full" && content.length === 4
    && content[0]?.type === "Divider" && isContainer(content[1], "page-fit")
    && content[2]?.type === "Divider" && isContainer(content[3], "page-fit")
  ) return block;
  const shellChildren = isContainer(content[0], "full") ? childrenOf(content[0].props as BlockProps) : content;
  const dividers = shellChildren.filter((child) => child.type === "Divider");
  const columns = findNested(shellChildren, "Columns");
  const credits = findNested(shellChildren, "Text");
  if (!columns || !credits || dividers.length < 2) return block;

  const normalized: BlockList = [
    dividers[0],
    {
      type: "Container",
      props: {
        overallWidth: "page-fit",
        _style: zeroPaddingLayout(0),
        content: [{ ...columns, props: { ...columns.props, overallWidth: "full" } }],
      },
    },
    dividers[1],
    {
      type: "Container",
      props: {
        overallWidth: "page-fit",
        _style: { ...zeroPaddingLayout(0), contentHorizontalAlign: "start" },
        content: [credits],
      },
    },
  ];
  return { ...block, props: { ...props, overallWidth: "full", content: normalized } };
}

function normalizeLeadCollections(block: PuckBlockEntry): PuckBlockEntry {
  const props = block.props as BlockProps;
  const storedContent = childrenOf(props);
  if (
    props.overallWidth === "full" && storedContent.length === 2
    && isContainer(storedContent[0], "page-fit") && isContainer(storedContent[1], "page-fit")
  ) return block;
  const content = unwrappedPageFitShell(storedContent);
  const columns = findNested(content, "Columns");
  const heading = findNested(content, "Heading");
  const text = findNested(content, "Text");
  if (!columns || !heading || !text) return block;

  const normalized: BlockList = [
    {
      type: "Container",
      props: {
        overallWidth: "page-fit",
        _style: { ...zeroPaddingLayout(12), bgColorToken: "accent", textColorToken: "foreground" },
        content: [heading, text],
      },
    },
    {
      type: "Container",
      props: {
        overallWidth: "page-fit",
        _style: zeroPaddingLayout(0),
        content: [{ ...columns, props: { ...columns.props, overallWidth: "full" } }],
      },
    },
  ];
  return { ...block, props: { ...props, overallWidth: "full", content: normalized } };
}

/** Apply the current preset structure to stored drafts and published page data. */
export function normalizePresetLayouts<T extends PuckData>(data: T): T {
  return mapBlocks(data, (block) => {
    if (block.type === "FeaturedWorkLeadPreset") return normalizeLeadCollections(block);
    if (block.type === "FooterDirectoryPreset") return normalizeDirectoryFooter(block);
    if (DIVIDER_GROUP_PRESETS.has(block.type)) return normalizeDividerGroups(block);
    return block;
  }) as T;
}

/** Template seeds use the same migration as saved pages before they are applied. */
export function normalizeTemplatePresetLayouts(data: PortfolioPuckData): PortfolioPuckData {
  return {
    ...data,
    ...(data.home ? { home: normalizePresetLayouts(data.home) } : {}),
    ...(data.gallery ? { gallery: normalizePresetLayouts(data.gallery) } : {}),
  } as PortfolioPuckData;
}
