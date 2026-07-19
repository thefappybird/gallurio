import type { PortfolioSavedTheme } from "@/lib/page-builder/types";

/** Canonical form for case-insensitive name comparison. */
export function normalizeThemeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * True when `name` collides (case-insensitively) with an existing saved theme.
 * Pass the edited theme's id as `excludeId` so a rename may keep its own name.
 * Empty/whitespace names are reported as not taken; required-name validation is
 * handled separately.
 */
export function isThemeNameTaken(
  name: string,
  savedThemes: Pick<PortfolioSavedTheme, "id" | "name">[],
  excludeId?: string
): boolean {
  const target = normalizeThemeName(name);
  if (!target) return false;
  return savedThemes.some(
    (t) => t.id !== excludeId && normalizeThemeName(t.name) === target
  );
}
