/**
 * next/dynamic wrappers for the client islands imported by isomorphic block
 * files (item 2b, docs/portfolio/puck-023-followups.md).
 *
 * Today every visitor of `/w/[orgSlug]` and `/portfolio-preview` downloads
 * every block's client JS through the one shared `puckConfig`, even though a
 * given portfolio only uses a fraction of the registered blocks. Wrapping the
 * island import here (not the whole block) means both consumers — the server
 * `Render` on the published page and the client `Render` on the preview route
 * — only fetch a given island's chunk when a rendered block actually mounts
 * it, without forking block behaviour between editor/preview/publish.
 *
 * SSR stays ON (the default — `ssr: false` is NOT used): these islands render
 * inside server-rendered/isomorphic block files and must still produce real
 * HTML (gallery tiles, collection covers, their `<img>`s) for crawlers.
 * `loading` renders nothing — each island's own block already paints its
 * empty/placeholder state, so there is nothing useful to show and no layout
 * to reserve.
 *
 * One export per island so this file is the single place to see what's
 * split. Above-the-fold blocks (Navigation/PortfolioHeader, hero/section
 * background slideshows) are deliberately NOT here — see the followups doc.
 *
 * NOT here: LazyLightbox / LazyCollectionPopup (the modal chunks opened by
 * GalleryLightboxTrigger / FeaturedCollectionsClient — item T4). Those two
 * `dynamic()` wrappers live locally in GalleryLightboxTrigger.tsx and
 * FeaturedCollectionsClient.tsx instead of here, deliberately: this file
 * already wraps GalleryLightboxTrigger/FeaturedCollectionsClient themselves
 * as islands (below), so a static `import ... from "./lazy"` inside either
 * of those two files would make this module and theirs mutually dependent.
 * webpack/Turbopack still dedupe the underlying chunk by resolved module
 * path regardless of which file calls `dynamic()` on it, so splitting stays
 * identical — only the declaration site moves.
 */

import dynamic from "next/dynamic";

export const LazyGalleryLightboxTrigger = dynamic(
  () => import("./GalleryLightboxTrigger").then((m) => m.GalleryLightboxTrigger),
  { loading: () => null },
);

export const LazyFeaturedCollectionsClient = dynamic(
  () => import("./FeaturedCollectionsClient").then((m) => m.FeaturedCollectionsClient),
  { loading: () => null },
);

export const LazyMasonryCloneClient = dynamic(
  () => import("./MasonryCloneClient").then((m) => m.MasonryCloneClient),
  { loading: () => null },
);
