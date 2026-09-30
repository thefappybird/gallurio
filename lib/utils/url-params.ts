/**
 * Mutate the current URL's query via the History API (no RSC round-trip).
 * Next syncs `useSearchParams` with pushState/replaceState. Reads
 * `window.location` so it never works from a stale `searchParams` snapshot.
 * Client-only.
 */
export function setUrlParams(
  mutate: (params: URLSearchParams) => void,
  mode: "push" | "replace" = "push"
): void {
  const url = new URL(window.location.href);
  mutate(url.searchParams);
  const next = url.pathname + url.search + url.hash;
  if (mode === "replace") window.history.replaceState(window.history.state, "", next);
  else window.history.pushState(window.history.state, "", next);
}
