/**
 * Normalizes persisted Puck page data before it is handed to the public
 * `@measured/puck` RSC `<Render>`.
 *
 * Why this exists: Puck's RSC `Render` does `"props" in data.root` with NO
 * defaulting of `data` or `data.root` (the CSR build defaults both). So any
 * stored page whose data is truthy but missing a valid `root` — or that carries
 * a malformed / unknown-type block — crashes the whole public route with
 * `TypeError: Cannot use 'in' operator to search for 'props' in undefined`.
 *
 * The public renderer consumes untrusted, possibly-legacy DB JSON, so it must be
 * resilient. This guarantees the invariant Render needs (a `root` object and a
 * `content` array of known-type blocks) or returns `null` so the caller can show
 * its "coming soon" fallback. It warns when it has to repair something, so an
 * upstream producer of bad data is observable in logs.
 */

export type NormalizedBlock = { type: string; props: Record<string, unknown> } & Record<
  string,
  unknown
>;

export type NormalizedPuckData = {
  root: Record<string, unknown>;
  content: NormalizedBlock[];
  zones?: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasZoneContent(zones: Record<string, unknown> | undefined): boolean {
  if (!zones) return false;
  return Object.values(zones).some((z) => Array.isArray(z) && z.length > 0);
}

/**
 * Single source of truth for "is this stored page data actually renderable" —
 * used by callers (sitemap/crawler routes) that must decide whether to
 * advertise a page URL without paying for full normalization.
 *
 * Deliberate divergence from `normalizePublicPageData`: this predicate has no
 * `knownTypes` set, so a page made ONLY of unregistered/legacy block types
 * still counts as renderable here (rare; accepted — the URL gets advertised,
 * and the page itself still falls back to "coming soon" if truly nothing
 * survives normalization at render time).
 */
export function hasRenderableBlocks(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  const content = Array.isArray(raw.content) ? raw.content : [];
  const zones = isPlainObject(raw.zones) ? raw.zones : undefined;
  return content.length > 0 || hasZoneContent(zones);
}

/**
 * @param raw         the value stored at `publicPage.data.<page>` (unknown shape)
 * @param knownTypes  the set of component `type`s registered in the Puck config
 * @param label       optional label (e.g. "home"/"gallery") for warning context
 * @returns a render-safe Puck data object, or `null` when nothing is renderable
 */
export function normalizePublicPageData(
  raw: unknown,
  knownTypes: ReadonlySet<string>,
  label = "page"
): NormalizedPuckData | null {
  if (!isPlainObject(raw)) return null;

  const rootDefaulted = !isPlainObject(raw.root);
  const root = isPlainObject(raw.root) ? raw.root : {};

  const rawContent = Array.isArray(raw.content) ? raw.content : [];
  const content: NormalizedBlock[] = [];
  for (const entry of rawContent) {
    if (!isPlainObject(entry)) continue;
    const type = entry.type;
    if (typeof type !== "string" || !knownTypes.has(type)) continue;
    const props = isPlainObject(entry.props) ? entry.props : {};
    content.push({ ...entry, type, props });
  }
  const droppedCount = rawContent.length - content.length;

  const zones = isPlainObject(raw.zones) ? raw.zones : undefined;

  // Nothing to show -> let the caller render its fallback (never crash, never blank).
  if (content.length === 0 && !hasZoneContent(zones)) return null;

  if (rootDefaulted || droppedCount > 0) {
    const parts: string[] = [];
    if (rootDefaulted) parts.push("missing root defaulted");
    if (droppedCount > 0) parts.push(`${droppedCount} invalid block(s) dropped`);
    console.warn(`[public-render] repaired ${label} page data: ${parts.join("; ")}`);
  }

  const result: NormalizedPuckData = { root, content };
  if (zones) result.zones = zones;
  return result;
}
