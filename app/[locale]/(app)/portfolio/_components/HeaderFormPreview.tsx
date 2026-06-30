"use client";

import type { PortfolioBrandKit, PortfolioHeaderConfig } from "@/lib/page-builder/types";

const FONT_SIZE_MAP: Record<string, string> = {
  sm: "0.8125rem",
  md: "0.9375rem",
  lg: "1.0625rem",
};

const SHADOW_MAP: Record<string, string> = {
  none: "none",
  sm: "0 1px 4px rgba(0,0,0,0.08)",
  md: "0 2px 12px rgba(0,0,0,0.12)",
  lg: "0 4px 24px rgba(0,0,0,0.18)",
};

const RADIUS_MAP: Record<string, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

const NAVBAR_SIZE_MAP = {
  sleek: {
    navPadding: "0.625rem 1.25rem",
    brandFontSize: "1rem",
    logoHeight: "1.5rem",
    navGap: "0.375rem",
    linkMinHeight: "40px",
    linkPaddingX: "0.625rem",
    contactMinHeight: "44px",
  },
  balanced: {
    navPadding: "0.75rem 1.5rem",
    brandFontSize: "1.125rem",
    logoHeight: "1.75rem",
    navGap: "0.5rem",
    linkMinHeight: "44px",
    linkPaddingX: "0.75rem",
    contactMinHeight: "44px",
  },
  flashy: {
    navPadding: "1rem 1.5rem",
    brandFontSize: "1.375rem",
    logoHeight: "2.125rem",
    navGap: "0.75rem",
    linkMinHeight: "48px",
    linkPaddingX: "0.9rem",
    contactMinHeight: "52px",
  },
} as const;

function resolveColor(token: string | undefined, brandKit: PortfolioBrandKit, fallback: string): string {
  if (!token) return fallback;
  if (token.startsWith("#")) return token;
  switch (token) {
    case "primary":
      return brandKit.primaryColor;
    case "secondary":
      return brandKit.secondaryColor;
    case "accent":
      return brandKit.accentColor;
    case "background":
      return brandKit.backgroundColor;
    case "foreground":
      return brandKit.foregroundColor;
    default:
      return fallback;
  }
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

function withOpacity(color: string, opacity: number): string {
  if (opacity >= 100) return color;
  if (color.startsWith("#") && color.length === 7) return hexToRgba(color, opacity);
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
}

type Props = {
  header: PortfolioHeaderConfig;
  brandKit: PortfolioBrandKit;
  workspaceName: string;
};

// NOTE: This is a static mock that duplicates PortfolioHeader's visual structure for the
// editor preview panel. It does NOT inherit PortfolioHeader's styles or logic. These two
// components should eventually be de-duplicated into a shared renderer.
export function HeaderFormPreview({ header, brandKit, workspaceName }: Props) {
  const bgColorHex = resolveColor(header.backgroundColor, brandKit, brandKit.backgroundColor);
  const opacity = header.backgroundOpacity ?? 100;
  const bgFinal = opacity < 100 ? hexToRgba(bgColorHex, opacity) : bgColorHex;

  const shadow = header.shadowSize ? (SHADOW_MAP[header.shadowSize] ?? "none") : "none";
  const borderBottom = header.borderBottomWidth
    ? `${header.borderBottomWidth}px solid ${resolveColor(header.borderBottomColor, brandKit, brandKit.foregroundColor + "40")}`
    : `1px solid ${brandKit.foregroundColor}20`;

  const fontSize = header.fontSize ? (FONT_SIZE_MAP[header.fontSize] ?? "0.9375rem") : "0.9375rem";
  const brandRadius = RADIUS_MAP[brandKit.radius ?? "sharp"] ?? "0";
  const navbarSize = NAVBAR_SIZE_MAP[header.navbarSize || "balanced"];

  const linkColor = resolveColor(header.linkColor, brandKit, brandKit.foregroundColor);
  const brandTextColor = resolveColor(header.brandTextColor, brandKit, brandKit.foregroundColor);
  const activeLinkColor = resolveColor(header.activeLinkColor, brandKit, brandKit.foregroundColor);

  function getActiveLinkStyle(): React.CSSProperties {
    const style: React.CSSProperties = {
      color: activeLinkColor,
      fontFamily: "var(--pf-font-body)",
    };
    if (header.activeLinkScale) {
      style.transform = "scale(1.08)";
      style.fontWeight = 700;
    }
    if (header.activeLinkHighlight) {
      const highlightColor = resolveColor(header.highlightColor, brandKit, brandKit.accentColor);
      style.backgroundColor = withOpacity(highlightColor, header.highlightOpacity ?? 100);
      style.borderRadius = header.activeLinkRadius
        ? (RADIUS_MAP[header.activeLinkRadius] ?? brandRadius)
        : brandRadius;
    }
    // Effective default ON: underline shows unless explicitly disabled (=== false).
    // Mirrors HeaderPanelDialog's toggleUnderline cycle (undefined/true → false → undefined),
    // which never sets this to an explicit `true` — a strict-truthy check here would
    // never render the underline.
    if (header.activeLinkUnderline !== false) {
      style.borderBottom = `3px solid ${resolveColor(header.underlineColor, brandKit, brandKit.accentColor)}`;
    }
    return style;
  }

  const navLinkBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: navbarSize.linkMinHeight,
    padding: `0 ${navbarSize.linkPaddingX}`,
    textDecoration: "none",
    fontSize,
    fontFamily: "var(--pf-font-body)",
    borderRadius: brandRadius,
    color: linkColor,
    borderBottom: "3px solid transparent",
    transition: "all 0.15s",
  };

  const activeStyle = getActiveLinkStyle();
  const activeLinkStyle: React.CSSProperties = { ...navLinkBase, ...activeStyle };

  const contactBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: navbarSize.contactMinHeight,
    minWidth: 0,
    padding: "0 1rem",
    backgroundColor: withOpacity(
      resolveColor(header.contactButtonColor, brandKit, brandKit.primaryColor),
      header.contactButtonOpacity ?? 100,
    ),
    color: resolveColor(header.contactButtonTextColor, brandKit, brandKit.backgroundColor),
    border: "none",
    borderRadius: header.contactButtonRadius ? (RADIUS_MAP[header.contactButtonRadius] ?? brandRadius) : brandRadius,
    cursor: "default",
    fontSize,
    fontFamily: "var(--pf-font-body)",
  };

  const brandText = header.brandText === undefined ? workspaceName : header.brandText.trim();

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/40" aria-hidden="true">
      <div
        style={{
          backgroundColor: bgFinal,
          boxShadow: shadow,
          borderBottom,
          position: "sticky",
          top: 0,
          zIndex: 10,
          fontFamily: "var(--pf-font-body)",
        }}
      >
        <nav
          style={{
            maxWidth: "80rem",
            margin: "0 auto",
            padding: navbarSize.navPadding,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {header.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={header.logoUrl}
                alt="Logo"
                style={{ height: navbarSize.logoHeight, maxWidth: "40%", width: "auto", objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
                color: brandTextColor,
                fontSize: navbarSize.brandFontSize,
                fontWeight: 700,
                fontFamily: "var(--pf-font-heading)",
              }}
            >
              {brandText}
            </span>
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: `clamp(0.25rem, 1.5vw, ${navbarSize.navGap})` }}>
            <span style={activeLinkStyle}>Home</span>
            <span style={navLinkBase}>Gallery</span>
            <button type="button" style={contactBtnStyle} tabIndex={-1}>
              Contact
            </button>
          </div>
        </nav>
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
        {[200, 160, 140, 180].map((w, i) => (
          <div
            key={i}
            style={{
              height: "0.75rem",
              width: `${w}px`,
              backgroundColor: brandKit.foregroundColor,
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
