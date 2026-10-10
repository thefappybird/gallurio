import { routing } from "@/lib/i18n/routing";

/**
 * Router-cache staleness tracking. Next reuses cached RSC payloads on
 * back/forward, so a route whose server data changed while the user was
 * elsewhere (or whose refresh was skipped via `{ refresh: false }`) must be
 * re-fetched when history lands on it.
 *
 * `router.refresh()` bumps GLOBAL segment/bfcache versions
 * (next/dist/client/components/segment-cache/cache.js:237-239 via
 * router-reducer/reducers/refresh-reducer.js:42, and bfcache.js:59 via
 * refresh-reducer.js:48), staling every cached route, not only the current one.
 * So any real refresh clears the whole dirty set.
 */

/** Drop a leading locale segment (`/fil/bookings` -> `/bookings`). Default locale has no prefix. */
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if (first && (routing.locales as readonly string[]).includes(first)) return "/" + rest.join("/");
  return pathname;
}

export function pathMatches(pathname: string, routes: string[]): boolean {
  const path = stripLocale(pathname);
  return routes.some((r) => r === "/" || path === r || path.startsWith(r + "/"));
}

/** Routes whose cached payload is stale after an event, given what refreshes right now. */
export function routesToMark(routes: string[], pathname: string, refreshingCurrent: boolean): string[] {
  return refreshingCurrent ? routes.filter((r) => !pathMatches(pathname, [r])) : routes;
}

/** True (and clears the set) when `pathname` is a dirty route — the caller then refreshes once. */
export function consumeDirty(dirty: Set<string>, pathname: string): boolean {
  if (dirty.size === 0 || !pathMatches(pathname, [...dirty])) return false;
  dirty.clear();
  return true;
}

const dirtyRoutes = new Set<string>();

export function markRoutesDirty(routes: string[], pathname: string, refreshingCurrent: boolean): void {
  for (const r of routesToMark(routes, pathname, refreshingCurrent)) dirtyRoutes.add(r);
}

export function clearDirtyRoutes(): void {
  dirtyRoutes.clear();
}

export function consumeDirtyFor(pathname: string): boolean {
  return consumeDirty(dirtyRoutes, pathname);
}
