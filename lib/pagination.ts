// Shared allowed page sizes — used by both the client `PageSizeSelect`
// dropdown and the server pages that clamp the `limit` search param, so the
// two stay in sync. Kept in a plain module (no "use client") so Server
// Components import the real array, not a client-reference proxy.
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

// Named default (== PAGE_SIZE_OPTIONS[0]) so both a page's search-param
// fallback and its loading skeleton's row count derive from one source.
export const DEFAULT_PAGE_SIZE = 10;
