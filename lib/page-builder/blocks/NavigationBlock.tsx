/**
 * NavigationBlock — ISOMORPHIC (client-safe) pinned site header.
 *
 * Renders `PortfolioHeader` from its OWN props — the full `PortfolioHeaderConfig`
 * shape — plus a free `content` slot (seeded with just a brand Heading; no
 * Image child by default — an empty Image renders an "unavailable" placeholder
 * on the public page, so owners add a logo Image block themselves) that the
 * owner may restyle or delete. The slot is threaded through
 * `PortfolioHeader`'s `brandSlot` prop, so it occupies the SAME row as the nav
 * links (left side), not a separate row. The nav links (Home/Gallery) and the
 * contact button are rendered by `PortfolioHeader` itself from this block's
 * config fields, so they can never be removed.
 *
 * `_chrome: "nav"` marks this block for `chromeSync.ts` (home/gallery mirroring)
 * and `detached` opts a single zone out of that sync — both wired up by a later
 * EditorShell change; this file only carries the marker props they key off.
 *
 * No DB access, no server context, no server-only imports — the SAME component
 * renders in the editor canvas AND on the public page.
 */

import type { ComponentConfig, Slot, SlotComponent } from "@measured/puck";
import { PortfolioHeader } from "@/app/(public)/w/[orgSlug]/_components/PortfolioHeader";
import { portfolioGalleryPath, portfolioHomePath } from "@/lib/portfolio/publicUrl";
import type { PortfolioHeaderConfig } from "@/lib/page-builder/types";
import { DEFAULT_HEADER_CONFIG } from "@/lib/page-builder/types";
import {
  getRenderWorkspaceFrom,
  getNavChromeLabelsFrom,
  getPreviewNavFrom,
  type BlockPuck,
} from "@/lib/page-builder/blockContext";
import type { ChromeKind } from "@/lib/page-builder/chromeSync";
import { productionStyleField, type BlockStyle } from "@/lib/page-builder/styleToolkit";
import { child, slot } from "./presets/_helpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type NavigationBlockProps = PortfolioHeaderConfig & {
  /** Marks this block for chromeSync's home/gallery mirroring. Always "nav" here. */
  _chrome?: ChromeKind;
  /** Opts this zone's copy out of chrome sync — at most one zone per kind. */
  detached?: boolean;
  /** Round-trip-only on the public/production path (see `navigationFields`'s
   *  `_style: productionStyleField`). The Navigation block's own render never
   *  reads this — its styling lives on the `PortfolioHeaderConfig` fields
   *  above, edited via StyleToolkitField's NAV_PRESET_KEYS panel. */
  _style?: BlockStyle;
  /** Free slot for the logo/title — fully editable, restyleable, deletable. */
  content: Slot;
};

export const navigationDefaultProps: NavigationBlockProps = {
  ...DEFAULT_HEADER_CONFIG,
  _chrome: "nav",
  // No Image child: an empty Image renders an "Image unavailable" placeholder
  // on the public page (ImageBlock, manualBlocks.tsx) — the owner adds a logo
  // Image block into this slot once they have one.
  content: slot([child("Heading", { level: "h3", text: "Studio Name" })]),
};

// ---------------------------------------------------------------------------
// Render — same component for the editor canvas and the public renderer.
// ---------------------------------------------------------------------------

export function NavigationBlock({
  content: Content,
  puck,
  detached: _detached,
  _chrome: _chromeMark,
  _style: _styleIgnored,
  ...config
}: Omit<NavigationBlockProps, "content"> & { content?: Slot | SlotComponent; puck?: BlockPuck }) {
  const workspace = getRenderWorkspaceFrom(puck);
  const labels = getNavChromeLabelsFrom(puck);
  const previewNav = getPreviewNavFrom(puck);
  const slug = workspace?.slug ?? "";
  const SlotContent = typeof Content === "function" ? Content : undefined;

  return (
    <div ref={puck?.dragRef ?? undefined} data-block="navigation">
      <PortfolioHeader
        slug={slug}
        homeHref={previewNav?.homeHref ?? portfolioHomePath(slug)}
        galleryHref={previewNav?.galleryHref ?? portfolioGalleryPath(slug)}
        activePath={previewNav?.activePath}
        labels={{
          brand: workspace?.name ?? "",
          navLandmark: labels.navLandmark,
          home: labels.home,
          gallery: labels.gallery,
          contact: labels.contact,
          openMenu: labels.openMenu,
          closeMenu: labels.closeMenu,
        }}
        config={config as PortfolioHeaderConfig}
        brandSlot={SlotContent?.({
          style: { display: "flex", alignItems: "center", gap: "0.625rem" },
        })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Puck field config — shared by the production `puckConfig` (config.ts) and
// editorConfig.tsx's Navigation branch. `_style` stays the inert
// `productionStyleField` placeholder here (mirrors `containerFields`) so the
// key round-trips and this file never pulls the "use client" StyleToolkitField
// into the server-rendered production config. The REAL editing UI (the
// NAV_PRESET_KEYS panel in StyleToolkitField.tsx's ContentInputs) must be
// wired by an editor-only `_style` override in editorConfig.tsx — see this
// file's header comment / the handoff note in the task report; editorConfig.tsx
// currently reuses `navigationFields` verbatim with no such override.
// ---------------------------------------------------------------------------

export const navigationFields = {
  _style: productionStyleField,
  content: { type: "slot" },
} as unknown as ComponentConfig<NavigationBlockProps>["fields"];

// Puck 0.20 permissions: pinned, undeletable, unreorderable. `insert`/`edit`
// stay at their defaults (true) — the slot children remain addable/editable.
export const navigationPermissions: ComponentConfig<NavigationBlockProps>["permissions"] = {
  delete: false,
  duplicate: false,
  drag: false,
};

/** Production (static-label) Puck component config — mirrors `containerBlockConfig`. */
export const navigationBlockConfig: ComponentConfig<NavigationBlockProps> = {
  label: "Navigation",
  inline: true,
  defaultProps: navigationDefaultProps,
  fields: navigationFields,
  permissions: navigationPermissions,
  render: NavigationBlock,
};
