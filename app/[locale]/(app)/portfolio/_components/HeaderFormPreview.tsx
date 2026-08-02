"use client";

import type { CSSProperties } from "react";
import { PortfolioHeader } from "@/app/(public)/w/[orgSlug]/_components/PortfolioHeader";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import type {
  PortfolioBrandKit,
  PortfolioHeaderConfig,
} from "@/lib/page-builder/types";

type Props = {
  header: PortfolioHeaderConfig;
  brandKit: PortfolioBrandKit;
  workspaceName: string;
};

/**
 * Header editor preview.
 *
 * This deliberately renders the production PortfolioHeader instead of a visual
 * facsimile. Keeping one renderer is what guarantees that effective values in
 * the editor (active-link defaults in particular) match preview and publish.
 */
export function HeaderFormPreview({ header, brandKit, workspaceName }: Props) {
  const { cssVars, className } = resolveBrandKit(brandKit);

  return (
    <div
      className={`${className} relative h-full w-full overflow-hidden bg-muted/40`}
      style={cssVars as CSSProperties}
      aria-hidden="true"
    >
      <div style={{ pointerEvents: "none" }}>
        <PortfolioHeader
          slug="editor-preview"
          labels={{
            brand: workspaceName,
            navLandmark: "Portfolio",
            home: "Home",
            gallery: "Gallery",
            contact: "Contact",
            openMenu: "Open menu",
            closeMenu: "Close menu",
          }}
          config={header}
          activePath="/"
          homeHref="/"
          galleryHref="/gallery"
        />
      </div>

      <div
        style={{
          padding: "3rem 2rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          opacity: 0.15,
        }}
      >
        {[200, 160, 140, 180].map((width) => (
          <div
            key={width}
            style={{
              height: "0.75rem",
              width: `${width}px`,
              backgroundColor: "var(--pf-color-fg)",
              borderRadius: "2px",
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: "0.75rem",
          color: "#888",
          pointerEvents: "none",
        }}
      >
        &quot;Home&quot; shown as active to preview link styles
      </div>
    </div>
  );
}
