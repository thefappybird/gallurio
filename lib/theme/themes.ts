import { MoonIcon, MonitorIcon, SunIcon, type LucideIcon } from "lucide-react";

export type ThemeScheme = "light" | "dark";

export type ThemeOption = {
  /** next-themes id and HTML class applied to <html>. */
  id: string;
  /** Translation key under `app.theme.*` for the label. */
  labelKey: string;
  /** Icon shown in the toggle + settings UI. */
  icon: LucideIcon;
  /**
   * Whether this theme reads as light or dark for downstream consumers
   * (Clerk, Sonner, any code that needs a binary scheme). Use "system" for
   * the OS-driven option only.
   */
  scheme: ThemeScheme | "system";
};

/**
 * Adding a new theme:
 *   1. Add an entry here (unique `id`, label key, icon, scheme).
 *   2. Add a `.<id> { --background: …; … }` block in app/globals.css with a
 *      complete palette override.
 *   3. (Optional) Add the matching translation under `messages/<locale>.json`
 *      → `app.theme.<labelKey>`.
 * That's it — the toggle, settings UI, and theme-aware components pick it up.
 */
export const THEMES: readonly ThemeOption[] = [
  { id: "light", labelKey: "light", icon: SunIcon, scheme: "light" },
  { id: "dark", labelKey: "dark", icon: MoonIcon, scheme: "dark" },
  { id: "system", labelKey: "system", icon: MonitorIcon, scheme: "system" },
];

/** IDs passed to `<NextThemesProvider themes={…}>`. Excludes `system`. */
export const SELECTABLE_THEME_IDS = THEMES.filter(
  (t) => t.scheme !== "system"
).map((t) => t.id);

/**
 * Map a resolved theme id (what next-themes hands back) to its binary scheme.
 * Used by Clerk and Sonner to decide whether to apply dark styling.
 */
export function resolveScheme(themeId: string | undefined | null): ThemeScheme {
  if (!themeId) return "light";
  const found = THEMES.find((t) => t.id === themeId);
  return found?.scheme === "dark" ? "dark" : "light";
}
