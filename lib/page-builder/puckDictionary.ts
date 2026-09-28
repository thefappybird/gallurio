import type { Dictionary } from "@puckeditor/core";

// Puck 0.23's built-in chrome strings (header/outline/drawer/viewport/etc.), excluding
// the field-richtext-* keys — this app registers no richtext field, so those never render.
// Verified against @puckeditor/core's defaultDictionary (node_modules/@puckeditor/core/dist/index-*.d.ts).
export const PUCK_CHROME_KEYS = [
  "header-publish",
  "header-undo",
  "header-redo",
  "header-toggle-leftsidebar",
  "header-toggle-rightsidebar",
  "header-toggle-menubar",
  "action-selectparent",
  "action-duplicate",
  "action-delete",
  "label-page",
  "label-component",
  "outline-empty",
  "outline-item-collapse",
  "outline-item-expand",
  "outline-header-title",
  "outline-header-collapseall",
  "outline-item-duplicate",
  "outline-item-delete",
  "drawer-category-collapse",
  "drawer-category-expand",
  "drawer-category-other",
  "canvas-noconfig",
  "field-readonly",
  "field-arrayitem-summary",
  "field-arrayitem-duplicate",
  "field-arrayitem-delete",
  "field-external-selectdata",
  "field-external-search",
  "field-external-togglefilters",
  "field-external-item",
  "field-external-result-singular",
  "field-external-result-plural",
  "viewport-zoom-in",
  "viewport-zoom-out",
  "viewport-zoom-auto",
  "viewport-toggle-menu",
  "viewport-switch",
  "viewport-switch-default",
  "plugin-blocks",
  "plugin-outline",
  "plugin-fields",
  "plugin-components",
  "layout-maximize",
  "layout-minimize",
  "loader-loading",
] as const;

export type PuckChromeKey = (typeof PUCK_CHROME_KEYS)[number];

/**
 * Builds a Puck `dictionary` prop value from a raw string accessor (e.g. `t.raw`
 * from next-intl), so Puck's own `{placeholder}` interpolation syntax passes
 * through untouched instead of being parsed as an ICU argument.
 */
export function buildPuckDictionary(raw: (key: PuckChromeKey) => string): Dictionary {
  const dictionary: Dictionary = {};
  for (const key of PUCK_CHROME_KEYS) {
    dictionary[key] = raw(key);
  }
  return dictionary;
}
