import type { ComponentConfig } from "@measured/puck";
import { PortfolioHeader } from "@/app/(public)/w/[orgSlug]/_components/PortfolioHeader";
import type { BlockPuck } from "@/lib/page-builder/blockContext";
import type { PortfolioHeaderConfig } from "@/lib/page-builder/types";

export type NavigationBlockProps = {
  config?: PortfolioHeaderConfig;
};

const FALLBACK_LABELS = {
  brand: "Portfolio",
  navLandmark: "Portfolio navigation",
  home: "Home",
  gallery: "Gallery",
  contact: "Contact",
  openMenu: "Open menu",
  closeMenu: "Close menu",
};

/** Migration-safe Puck wrapper around the production responsive navigation. */
export function NavigationBlock({ config, puck }: NavigationBlockProps & { puck?: BlockPuck }) {
  const workspace = puck?.metadata?.workspace ?? null;
  const chrome = workspace?.chrome?.navigation;
  const labels = {
    ...FALLBACK_LABELS,
    ...chrome?.labels,
    brand: config && "brandText" in config
      ? config.brandText?.trim() || chrome?.labels?.brand || workspace?.name || FALLBACK_LABELS.brand
      : chrome?.labels?.brand || workspace?.name || FALLBACK_LABELS.brand,
  };
  const slug = workspace?.slug || "portfolio";

  return (
    <PortfolioHeader
      slug={slug}
      labels={labels}
      config={config}
      activePath={chrome?.activePath}
      homeHref={chrome?.homeHref}
      galleryHref={chrome?.galleryHref}
    />
  );
}

export const navigationBlockConfig: ComponentConfig<NavigationBlockProps> = {
  label: "Navigation",
  defaultProps: { config: {} },
  fields: {},
  permissions: {
    drag: false,
    duplicate: false,
    delete: false,
    insert: false,
  },
  render: NavigationBlock,
};
