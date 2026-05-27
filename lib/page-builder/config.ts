/**
 * Shared Puck configuration for Gallurio portfolio pages.
 *
 * Imported by:
 * - app/(public)/w/[orgSlug]/page.tsx  → <Render data={...} config={puckConfig} />
 * - app/[locale]/(app)/page-builder/  → <Puck data={...} config={puckConfig} onPublish={...} />
 *
 * Phase 3 will fill `components` with the block implementations.
 * Phase 1 intentionally ships an empty registry so the renderer and editor
 * can both import a stable entry-point without circular dependencies.
 */

import type { Config } from "@measured/puck";

/**
 * Union of all portfolio block component names.
 * Filled in Phase 3: Hero, About, GalleryGrid, ServicesList, CTABanner,
 * ContactCard, GalleryMasonry, GalleryCarousel, FeaturedWork, Testimonials.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Components = {
  // Populated in Phase 3
};

export const puckConfig: Config<Components> = {
  components: {},
  root: {
    fields: {},
  },
};
