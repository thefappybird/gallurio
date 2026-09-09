/**
 * Applies PageBody's container defaults only to Containers introduced by the
 * latest Puck change. Keeping this as an insertion-time transform is crucial:
 * a PageBody preference is a convenience for future work, not a migration that
 * rewrites an owner's existing composition.
 */
import { collectBlocks, mapBlocks } from "./blockTree";
import type { PageBodyContainerDefaults } from "./blocks/PageBodyBlock";
import type { PuckData, PuckBlockEntry } from "./types";
import type { BlockStyle } from "./styleToolkit";
import { SECTION_PRESET_KEYS, NAV_PRESET_KEYS } from "./blocks/sectionPresets";

// Every section preset is a Container under the hood (shares _style/overallWidth),
// so a PageBody default must reach it the same as a plain Container or Columns —
// nav presets are excluded, they render through NavigationBlock, not a Container.
const CONTAINER_CLASS_TYPES = new Set<string>([
  "Container",
  "Columns",
  ...SECTION_PRESET_KEYS.filter((key) => !(NAV_PRESET_KEYS as readonly string[]).includes(key)),
]);

function blockId(block: PuckBlockEntry): string | undefined {
  const id = (block.props as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function isConfigured(defaults: PageBodyContainerDefaults | undefined): defaults is PageBodyContainerDefaults {
  return Boolean(
      defaults && (
      defaults.radius !== undefined ||
      defaults.paddingTop !== undefined ||
      defaults.paddingRight !== undefined ||
      defaults.paddingBottom !== undefined ||
      defaults.paddingLeft !== undefined ||
      defaults.marginTop !== undefined ||
      defaults.marginRight !== undefined ||
      defaults.marginBottom !== undefined ||
      defaults.marginLeft !== undefined ||
      defaults.padding !== undefined ||
      defaults.margin !== undefined ||
      defaults.gap !== undefined ||
      defaults.overallWidth !== undefined
    ),
  );
}

function containerIdsInsidePageBody(data: PuckData): Set<string> {
  const pageBody = collectBlocks(data).find((block) => block.type === "PageBody");
  if (!pageBody) return new Set();

  // `collectBlocks` deliberately follows all Puck slots. Starting at PageBody
  // therefore excludes Navigation/Footer and includes nested preset Containers.
  const bodyTree = { ...data, content: [pageBody], zones: {} } as PuckData;
  return new Set(
    collectBlocks(bodyTree)
      .filter((block) => CONTAINER_CLASS_TYPES.has(block.type))
      .map(blockId)
      .filter((id): id is string => Boolean(id)),
  );
}

function applyStyleDefaults(style: BlockStyle | undefined, defaults: PageBodyContainerDefaults): BlockStyle | undefined {
  const next: BlockStyle = { ...(style ?? {}) };
  let changed = false;
  const set = <K extends keyof BlockStyle>(key: K, value: BlockStyle[K] | undefined) => {
    if (value !== undefined && next[key] === undefined) {
      next[key] = value;
      changed = true;
    }
  };

  set("radius", defaults.radius);
  set("gap", defaults.gap);
  set("paddingTop", defaults.paddingTop ?? defaults.padding);
  set("paddingRight", defaults.paddingRight ?? defaults.padding);
  set("paddingBottom", defaults.paddingBottom ?? defaults.padding);
  set("paddingLeft", defaults.paddingLeft ?? defaults.padding);
  set("marginTop", defaults.marginTop ?? defaults.margin);
  set("marginRight", defaults.marginRight ?? defaults.margin);
  set("marginBottom", defaults.marginBottom ?? defaults.margin);
  set("marginLeft", defaults.marginLeft ?? defaults.margin);
  return changed ? next : style;
}

/**
 * Materialize PageBody defaults for newly-added Containers and nothing else.
 * Returns the original data reference when no default applies, allowing the
 * caller to avoid a needless uncontrolled-Puck remount.
 */
export function applyPageBodyContainerDefaults(previous: PuckData, next: PuckData): PuckData {
  const pageBody = collectBlocks(next).find((block) => block.type === "PageBody");
  const defaults = pageBody?.props.containerDefaults as PageBodyContainerDefaults | undefined;
  if (!isConfigured(defaults)) return next;

  const previousIds = new Set(collectBlocks(previous).map(blockId).filter((id): id is string => Boolean(id)));
  const eligibleIds = containerIdsInsidePageBody(next);
  if (eligibleIds.size === 0) return next;

  return mapBlocks(next, (block) => {
    const id = blockId(block);
    if (!CONTAINER_CLASS_TYPES.has(block.type) || !id || previousIds.has(id) || !eligibleIds.has(id)) return block;

    const props = block.props as { _style?: BlockStyle; overallWidth?: "page-fit" | "full" };
    const nextStyle = applyStyleDefaults(props._style, defaults);
    const nextOverallWidth = props.overallWidth ?? defaults.overallWidth;
    if (nextStyle === props._style && nextOverallWidth === props.overallWidth) return block;

    return {
      ...block,
      props: {
        ...props,
        ...(nextStyle !== props._style ? { _style: nextStyle } : {}),
        ...(nextOverallWidth !== props.overallWidth ? { overallWidth: nextOverallWidth } : {}),
      },
    } as PuckBlockEntry;
  });
}
