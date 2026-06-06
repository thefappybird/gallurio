"use client";

/**
 * Sticky public-portfolio navigation shown on both Home and Gallery.
 *
 * - Home / Gallery are real links; Contact is a `<button data-cta="contact">`
 *   that the layout's click-delegate wires to the contact modal.
 * - Brand-kit styled via the `--pf-*` CSS variables set by the public layout.
 * - Optional `headerConfig` overrides colors, shadow, border, and active link styles.
 * - Mobile: a hamburger toggles a slide-out panel that closes on link tap.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortfolioHeaderConfig } from "@/lib/page-builder/types";

export type PortfolioHeaderLabels = {
  brand: string;
  navLandmark: string;
  home: string;
  gallery: string;
  contact: string;
  openMenu: string;
  closeMenu: string;
};

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

/** Resolve a color token or hex to a CSS value usable in inline style. */
function resolveColor(token: string | undefined, fallback: string): string {
  if (!token) return fallback;
  if (token.startsWith("#")) return token;
  // Map token names to CSS custom properties set by the public layout.
  switch (token) {
    case "primary":    return "var(--pf-color-primary)";
    case "secondary":  return "var(--pf-color-secondary)";
    case "accent":     return "var(--pf-color-accent)";
    case "background": return "var(--pf-color-bg)";
    case "foreground": return "var(--pf-color-fg)";
    default:           return fallback;
  }
}

/** Build `color-mix(...)` for opacity < 100, plain color otherwise. */
function buildBg(config: PortfolioHeaderConfig | null | undefined): string {
  const bgColor = resolveColor(config?.backgroundColor, "var(--pf-color-bg)");
  const opacity = config?.backgroundOpacity ?? 100;
  if (opacity >= 100) return bgColor;
  return `color-mix(in srgb, ${bgColor} ${opacity}%, transparent)`;
}

export function PortfolioHeader({
  slug,
  labels,
  config,
}: {
  slug: string;
  labels: PortfolioHeaderLabels;
  config?: PortfolioHeaderConfig | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const homeHref = `/w/${slug}`;
  const galleryHref = `/w/${slug}/gallery`;

  const isHomeActive = pathname === homeHref || pathname === `/w/${slug}/`;
  const isGalleryActive = pathname === galleryHref;

  const fontSize = config?.fontSize ? (FONT_SIZE_MAP[config.fontSize] ?? "0.9375rem") : "0.9375rem";
  const linkColor = resolveColor(config?.linkColor, "var(--pf-color-fg)");
  const activeLinkColor = resolveColor(config?.activeLinkColor, "var(--pf-color-fg)");
  const shadow = config?.shadowSize ? (SHADOW_MAP[config.shadowSize] ?? "none") : "none";

  const borderBottomStyle =
    config?.borderBottomWidth
      ? `${config.borderBottomWidth}px solid ${resolveColor(config.borderBottomColor, "color-mix(in srgb, var(--pf-color-fg) 14%, transparent)")}`
      : "1px solid color-mix(in srgb, var(--pf-color-fg) 14%, transparent)";

  function getActiveLinkExtraStyle(): React.CSSProperties {
    const style: React.CSSProperties = { color: activeLinkColor };
    if (config?.activeLinkScale) {
      style.transform = "scale(1.08)";
      style.fontWeight = 700;
      style.display = "inline-flex";
    }
    if (config?.activeLinkHighlight) {
      style.backgroundColor = resolveColor(
        config.highlightColor,
        "color-mix(in srgb, var(--pf-color-fg) 8%, transparent)",
      );
    }
    if (config?.activeLinkUnderline) {
      style.borderBottom = `3px solid ${resolveColor(config.underlineColor, "var(--pf-color-accent)")}`;
    }
    return style;
  }

  const activeLinkExtra = getActiveLinkExtraStyle();

  const brandText = config?.brandText?.trim() || labels.brand;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: buildBg(config),
        borderBottom: borderBottomStyle,
        boxShadow: shadow,
        fontFamily: "var(--pf-font-body)",
      }}
    >
      <nav
        aria-label={labels.navLandmark}
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
        <Link
          href={homeHref}
          style={{
            fontFamily: "var(--pf-font-heading)",
            color: linkColor,
            fontSize: "1.125rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          {config?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.logoUrl}
              alt=""
              aria-hidden="true"
              style={{ height: "1.75rem", width: "auto", objectFit: "contain" }}
            />
          )}
          {brandText}
        </Link>

        {/* Desktop links */}
        <div className="pf-nav-desktop" style={{ alignItems: "center", gap: "0.5rem" }}>
          <HeaderLink
            href={homeHref}
            isActive={isHomeActive}
            linkColor={linkColor}
            fontSize={fontSize}
            activeStyle={activeLinkExtra}
          >
            {labels.home}
          </HeaderLink>
          <HeaderLink
            href={galleryHref}
            isActive={isGalleryActive}
            linkColor={linkColor}
            fontSize={fontSize}
            activeStyle={activeLinkExtra}
          >
            {labels.gallery}
          </HeaderLink>
          <ContactButton label={labels.contact} config={config} />
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="pf-nav-toggle"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? labels.closeMenu : labels.openMenu}
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
            color: "var(--pf-color-fg)",
            border: "1px solid color-mix(in srgb, var(--pf-color-fg) 24%, transparent)",
            borderRadius: "var(--pf-radius)",
            cursor: "pointer",
            fontSize: "1.25rem",
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        </button>
      </nav>

      {/* Mobile slide-out panel */}
      {menuOpen && (
        <div
          className="pf-nav-mobile"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            padding: "0.5rem 1.5rem 1rem",
            borderTop: "1px solid color-mix(in srgb, var(--pf-color-fg) 14%, transparent)",
          }}
        >
          <HeaderLink
            href={homeHref}
            onNavigate={() => setMenuOpen(false)}
            block
            isActive={isHomeActive}
            linkColor={linkColor}
            fontSize={fontSize}
            activeStyle={activeLinkExtra}
          >
            {labels.home}
          </HeaderLink>
          <HeaderLink
            href={galleryHref}
            onNavigate={() => setMenuOpen(false)}
            block
            isActive={isGalleryActive}
            linkColor={linkColor}
            fontSize={fontSize}
            activeStyle={activeLinkExtra}
          >
            {labels.gallery}
          </HeaderLink>
          <ContactButton label={labels.contact} block config={config} onActivate={() => setMenuOpen(false)} />
        </div>
      )}

      <style>{`
        .pf-nav-desktop { display: none; }
        .pf-nav-toggle { display: flex !important; }
        .pf-nav-link:focus-visible,
        .pf-nav-contact:focus-visible,
        .pf-nav-toggle:focus-visible {
          outline: 2px solid var(--pf-color-accent);
          outline-offset: 2px;
        }
        .pf-nav-link:hover { background-color: color-mix(in srgb, var(--pf-color-fg) 8%, transparent); }
        .pf-nav-contact:hover { opacity: 0.9; }
        @media (min-width: 640px) {
          .pf-nav-desktop { display: flex !important; }
          .pf-nav-toggle { display: none !important; }
          .pf-nav-mobile { display: none !important; }
        }
      `}</style>
    </header>
  );
}

function HeaderLink({
  href,
  children,
  onNavigate,
  block,
  isActive,
  linkColor,
  fontSize,
  activeStyle,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate?: () => void;
  block?: boolean;
  isActive?: boolean;
  linkColor: string;
  fontSize: string;
  activeStyle: React.CSSProperties;
}) {
  const baseStyle: React.CSSProperties = {
    display: block ? "block" : "inline-flex",
    alignItems: "center",
    minHeight: "44px",
    padding: "0 0.75rem",
    color: linkColor,
    textDecoration: "none",
    fontSize,
    borderRadius: "var(--pf-radius)",
    borderBottom: "3px solid transparent", // reserve space for underline
    transition: "background-color 0.15s",
  };
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="pf-nav-link"
      style={isActive ? { ...baseStyle, ...activeStyle } : baseStyle}
    >
      {children}
    </Link>
  );
}

function ContactButton({
  label,
  block,
  onActivate,
  config,
}: {
  label: string;
  block?: boolean;
  onActivate?: () => void;
  config?: PortfolioHeaderConfig | null;
}) {
  return (
    <button
      type="button"
      data-cta="contact"
      className="pf-nav-contact"
      onClick={onActivate}
      style={{
        display: block ? "block" : "inline-flex",
        width: block ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        minHeight: "44px",
        padding: "0 1rem",
        marginTop: block ? "0.25rem" : 0,
        backgroundColor: "var(--pf-color-primary)",
        color: "var(--pf-color-bg)",
        border: "none",
        borderRadius: "var(--pf-radius)",
        cursor: "pointer",
        fontSize: config?.fontSize ? (FONT_SIZE_MAP[config.fontSize] ?? "0.9375rem") : "0.9375rem",
        fontFamily: "var(--pf-font-body)",
      }}
    >
      {label}
    </button>
  );
}
