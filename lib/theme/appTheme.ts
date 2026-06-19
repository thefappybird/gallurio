/**
 * App-shell theming seam (foundation only — no user-facing UI yet).
 *
 * Mirrors the shape of the public-page `PortfolioBrandKit`
 * (lib/page-builder/types.ts) so the app shell can grow the same kind of
 * user-configurable styling later: corner style today, color/accent/base/font
 * presets next. Today this only carries `radius`, and the only consumer is the
 * root layout, which spreads `appThemeAttributes()` onto <html>. The attributes
 * key the CSS-variable overrides in app/globals.css:
 *
 *   html[data-radius="sharp"]   { --radius: 0;       --radius-surface: 0; }
 *   html[data-radius="subtle"]  { --radius: 0.25rem; --radius-surface: 0; }
 *   html[data-radius="rounded"] { --radius: 0.5rem;  --radius-surface: 0.5rem; }
 *
 * Extension path (when the user-theming feature ships):
 *   1. Add the new dimension here (e.g. `accent`, `base`) + its literal union.
 *   2. Emit a matching data-attribute from `appThemeAttributes` and add the
 *      keyed override block in globals.css.
 *   3. Persist the chosen config in a signed cookie (same pattern as the active
 *      workspace cookie, lib/auth/activeWorkspace.ts) and resolve it in the
 *      root layout, replacing DEFAULT_APP_THEME.
 * No component needs to change — they already read the CSS-var seam.
 */

/** Corner-style presets. Order is the intended sharp→round progression. */
export const APP_RADII = ["sharp", "subtle", "rounded"] as const;

export type AppRadius = (typeof APP_RADII)[number];

export interface AppThemeConfig {
  /** Corner style for the app shell. `subtle` is the shipped default. */
  radius: AppRadius;
  // Future: accent, base, font — add here, emit in appThemeAttributes, and key
  // a matching block in globals.css. See file header.
}

/** The shipped look: softened corners (controls 0.25rem, frame sharp). */
export const DEFAULT_APP_THEME: AppThemeConfig = {
  radius: "subtle",
};

/**
 * Map a config to the `<html>` data-attributes that drive the CSS-variable
 * overrides in globals.css. Returns a plain object so callers can spread it
 * directly onto a JSX element.
 */
export function appThemeAttributes(config: AppThemeConfig): Record<string, string> {
  return {
    "data-radius": config.radius,
  };
}
