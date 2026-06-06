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

function resolveColor(token: string | undefined, brandKit: PortfolioBrandKit, fallback: string): string {
  if (!token) return fallback;
  if (token.startsWith("#")) return token;
  switch (token) {
    case "primary":    return brandKit.primaryColor;
    case "secondary":  return brandKit.secondaryColor;
    case "accent":     return brandKit.accentColor;
    case "background": return brandKit.backgroundColor;
    case "foreground": return brandKit.foregroundColor;
    default:           return fallback;
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
  if (color.startsWith("#") && color.length === 7) {
    return hexToRgba(color, opacity);
  }
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
}

type Props = {
  header: PortfolioHeaderConfig;
  brandKit: PortfolioBrandKit;
  workspaceName: string;
};

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

  const linkColor = resolveColor(header.linkColor, brandKit, brandKit.foregroundColor);
  const activeLinkColor = resolveColor(header.activeLinkColor, brandKit, brandKit.foregroundColor);

  function getActiveLinkStyle(): React.CSSProperties {
    const style: React.CSSProperties = {
      color: activeLinkColor,
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
    if (header.activeLinkUnderline) {
      style.borderBottom = `3px solid ${resolveColor(header.underlineColor, brandKit, brandKit.accentColor)}`;
    }
    return style;
  }

  const navLinkBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "44px",
    padding: "0 0.75rem",
    textDecoration: "none",
    fontSize,
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
    minHeight: "44px",
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
    fontFamily: "inherit",
  };

  const brandText = header.brandText === undefined ? workspaceName : header.brandText.trim();

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-muted/40"
      aria-hidden="true"
    >
      {/* Header preview strip */}
      <div
        style={{
          backgroundColor: bgFinal,
          boxShadow: shadow,
          borderBottom,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Logo (if set) */}
        {header.logoUrl && (
          <div style={{ position: "absolute", left: "1.5rem", top: "50%", transform: "translateY(-50%)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={header.logoUrl} alt="Logo" style={{ height: "2rem", width: "auto", objectFit: "contain" }} />
          </div>
        )}
        <nav
          style={{
            maxWidth: "80rem",
            margin: "0 auto",
            padding: "0.75rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <span
            style={{
              color: linkColor,
              fontSize: "1.125rem",
              fontWeight: 700,
              textDecoration: "none",
              paddingLeft: header.logoUrl ? "2.5rem" : 0,
            }}
          >
            {brandText}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Home — marked as active */}
            <span style={activeLinkStyle}>Home</span>
            {/* Gallery — inactive */}
            <span style={navLinkBase}>Gallery</span>
            {/* Contact — CTA button */}
            <button type="button" style={contactBtnStyle} tabIndex={-1}>
              Contact
            </button>
          </div>
        </nav>
      </div>

      {/* Placeholder page body */}
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

      {/* Instructional caption */}
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
