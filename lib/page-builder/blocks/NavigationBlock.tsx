/**
 * NavigationBlock — ISOMORPHIC (client-safe) pinned site header.
 *
 * Renders `PortfolioHeader` (the existing, unmodified public-header component)
 * from its OWN props — the full `PortfolioHeaderConfig` shape — plus a free
 * `content` slot (seeded with a logo Image + brand Heading) that the owner may
 * restyle or delete. The nav links (Home/Gallery) and the contact button are
 * rendered by `PortfolioHeader` itself from this block's config fields, so they
 * can never be removed.
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
  type BlockPuck,
} from "@/lib/page-builder/blockContext";
import type { ChromeKind } from "@/lib/page-builder/chromeSync";
import { child, slot } from "./presets/_helpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type NavigationBlockProps = PortfolioHeaderConfig & {
  /** Marks this block for chromeSync's home/gallery mirroring. Always "nav" here. */
  _chrome?: ChromeKind;
  /** Opts this zone's copy out of chrome sync — at most one zone per kind. */
  detached?: boolean;
  /** Free slot for the logo/title — fully editable, restyleable, deletable. */
  content: Slot;
};

export const navigationDefaultProps: NavigationBlockProps = {
  ...DEFAULT_HEADER_CONFIG,
  _chrome: "nav",
  content: slot([
    child("Image", { alt: "Logo" }),
    child("Heading", { level: "h3", text: "Studio Name" }),
  ]),
};

// ---------------------------------------------------------------------------
// Render — same component for the editor canvas and the public renderer.
// ---------------------------------------------------------------------------

export function NavigationBlock({
  content: Content,
  puck,
  detached: _detached,
  _chrome: _chromeMark,
  ...config
}: NavigationBlockProps & { content: SlotComponent; puck?: BlockPuck }) {
  const workspace = getRenderWorkspaceFrom(puck);
  const labels = getNavChromeLabelsFrom(puck);
  const slug = workspace?.slug ?? "";

  return (
    <div ref={puck?.dragRef ?? undefined} data-block="navigation">
      {typeof Content === "function" &&
        Content({
          style: {
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.5rem 1.5rem",
          },
        })}
      <PortfolioHeader
        slug={slug}
        homeHref={portfolioHomePath(slug)}
        galleryHref={portfolioGalleryPath(slug)}
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
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Puck field config — shared by the production `puckConfig` and the editor
// config's own translated copy. Every `PortfolioHeaderConfig` field stays
// undeclared (data-only, no sidebar control) here; a later wave wires the
// full field panel through StyleToolkitField. Only the slot is editable now.
// ---------------------------------------------------------------------------

export const navigationFields = {
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
  render: NavigationBlock as ComponentConfig<NavigationBlockProps>["render"],
};
