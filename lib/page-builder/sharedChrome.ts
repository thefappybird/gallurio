import type {
  PortfolioHeaderConfig,
  PortfolioPuckData,
  PuckBlockEntry,
  PuckData,
} from "./types";
import { SECTION_PRESETS, type SectionPresetKey } from "./blocks/sectionPresets";

export const EMPTY_PUCK_DATA: PuckData = { content: [], root: {} };

export type PortfolioPuckDataWithChrome = Omit<
  PortfolioPuckData,
  "home" | "gallery" | "navigation" | "footer"
> & {
  home: PuckData;
  gallery: PuckData;
  navigation: PuckData;
  footer: PuckData;
};

function isFooterPreset(type: string): type is SectionPresetKey {
  return type in SECTION_PRESETS && SECTION_PRESETS[type as SectionPresetKey].group === "footer";
}

function isPuckBlockEntry(value: unknown): value is PuckBlockEntry {
  return Boolean(value) && typeof value === "object" && typeof (value as Partial<PuckBlockEntry>).type === "string";
}

function cloneBlockWithoutFooters(block: unknown): PuckBlockEntry | null {
  if (!isPuckBlockEntry(block)) return null;
  if (isFooterPreset(block.type)) return null;

  const blockProps = block.props && typeof block.props === "object" ? block.props : {};
  let changed = blockProps !== block.props;
  const props = Object.fromEntries(
    Object.entries(blockProps).map(([key, value]) => {
      if (!Array.isArray(value)) return [key, value];
      const looksLikeBlockList = value.every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof (entry as Partial<PuckBlockEntry>).type === "string" &&
          Boolean((entry as Partial<PuckBlockEntry>).props),
      );
      if (!looksLikeBlockList) return [key, value];
      const next = (value as PuckBlockEntry[])
        .map(cloneBlockWithoutFooters)
        .filter((entry): entry is PuckBlockEntry => entry !== null);
      changed ||= next.length !== value.length || next.some((entry, index) => entry !== value[index]);
      return [key, next];
    }),
  );

  return changed ? { ...block, props } : block;
}

function findFirstFooter(blocks: unknown[]): PuckBlockEntry | null {
  for (const candidate of blocks) {
    if (!isPuckBlockEntry(candidate)) continue;
    const block = candidate;
    if (isFooterPreset(block.type)) return block;
    const props = block.props && typeof block.props === "object" ? block.props : {};
    for (const value of Object.values(props)) {
      if (!Array.isArray(value)) continue;
      const nested = value.filter(
        (entry): entry is PuckBlockEntry =>
          Boolean(entry) &&
          typeof entry === "object" &&
          typeof (entry as Partial<PuckBlockEntry>).type === "string" &&
          Boolean((entry as Partial<PuckBlockEntry>).props),
      );
      const found = findFirstFooter(nested);
      if (found) return found;
    }
  }
  return null;
}

function findFirstFooterInData(data: PuckData): PuckBlockEntry | null {
  const contentFooter = findFirstFooter(data.content);
  if (contentFooter) return contentFooter;
  for (const blocks of Object.values(data.zones ?? {})) {
    const zoneFooter = findFirstFooter(blocks);
    if (zoneFooter) return zoneFooter;
  }
  return null;
}

export function stripPageLocalFooters(data: PuckData | null | undefined): PuckData {
  if (!data) return EMPTY_PUCK_DATA;
  const content = data.content
    .map(cloneBlockWithoutFooters)
    .filter((entry): entry is PuckBlockEntry => entry !== null);
  const zones = data.zones
    ? Object.fromEntries(
        Object.entries(data.zones).map(([key, blocks]) => [
          key,
          blocks.map(cloneBlockWithoutFooters).filter((entry): entry is PuckBlockEntry => entry !== null),
        ]),
      )
    : undefined;
  return { ...data, content, ...(zones ? { zones } : {}) };
}

export function createNavigationData(config: PortfolioHeaderConfig | null | undefined): PuckData {
  return {
    content: [
      {
        type: "Navigation",
        props: {
          id: "shared-navigation",
          config: config ?? {},
        },
      },
    ],
    root: {},
  };
}

export function readNavigationConfig(
  data: PuckData | null | undefined,
  fallback: PortfolioHeaderConfig,
): PortfolioHeaderConfig {
  const block = data?.content.find((entry) => isPuckBlockEntry(entry) && entry.type === "Navigation");
  const config = block?.props.config;
  return config && typeof config === "object"
    ? (config as PortfolioHeaderConfig)
    : fallback;
}

export function setNavigationConfig(data: PuckData, config: PortfolioHeaderConfig): PuckData {
  const index = data.content.findIndex((entry) => entry.type === "Navigation");
  if (index === -1) return createNavigationData(config);
  const content = [...data.content];
  content[index] = {
    ...content[index],
    props: { ...content[index].props, config },
  };
  return { ...data, content };
}

export function normalizeSharedChromeData(
  data: Partial<Record<"home" | "gallery" | "navigation" | "footer", PuckData | null | undefined>>,
  legacyHeader: PortfolioHeaderConfig | null | undefined,
): PortfolioPuckDataWithChrome {
  const rawHome = data.home ?? EMPTY_PUCK_DATA;
  const rawGallery = data.gallery ?? EMPTY_PUCK_DATA;
  const footerSeed =
    data.footer?.content.length
      ? data.footer
      : (() => {
          const block = findFirstFooterInData(rawHome) ?? findFirstFooterInData(rawGallery);
          return block ? { content: [block], root: {} } : EMPTY_PUCK_DATA;
        })();

  return {
    home: stripPageLocalFooters(rawHome),
    gallery: stripPageLocalFooters(rawGallery),
    navigation: data.navigation?.content.some((entry) => isPuckBlockEntry(entry) && entry.type === "Navigation")
      ? data.navigation
      : createNavigationData(legacyHeader),
    footer: footerSeed,
  };
}
