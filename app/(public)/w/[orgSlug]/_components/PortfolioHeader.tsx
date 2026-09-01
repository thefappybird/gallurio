"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortfolioHeaderConfig } from "@/lib/page-builder/types";
import { buildColorWithOpacity } from "@/lib/page-builder/styleToolkit";
import { useImageRetry } from "@/hooks/useImageRetry";

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

function resolveColor(token: string | undefined, fallback: string): string {
  if (!token) return fallback;
  if (token.startsWith("#")) return token;
  switch (token) {
    case "primary":
      return "var(--pf-color-primary)";
    case "secondary":
      return "var(--pf-color-secondary)";
    case "accent":
      return "var(--pf-color-accent)";
    case "background":
      return "var(--pf-color-bg)";
    case "foreground":
      return "var(--pf-color-fg)";
    default:
      return fallback;
  }
}

function buildBg(config: PortfolioHeaderConfig | null | undefined): string {
  const bgColor = resolveColor(config?.backgroundColor, "var(--pf-color-bg)");
  const opacity = config?.backgroundOpacity ?? 100;
  if (opacity >= 100) return bgColor;
  return `color-mix(in srgb, ${bgColor} ${opacity}%, transparent)`;
}

export function resolveHeaderBorderBottom(
  config: PortfolioHeaderConfig | null | undefined,
): string {
  return config?.borderBottomWidth
    ? `${config.borderBottomWidth}px solid ${resolveColor(
        config.borderBottomColor,
        "color-mix(in srgb, var(--pf-color-fg) 14%, transparent)",
      )}`
    : "1px solid color-mix(in srgb, var(--pf-color-fg) 14%, transparent)";
}


export function PortfolioHeader({
  slug,
  labels,
  config,
  activePath,
  homeHref: homeHrefProp,
  galleryHref: galleryHrefProp,
  brandSlot,
}: {
  slug: string;
  labels: PortfolioHeaderLabels;
  config?: PortfolioHeaderConfig | null;
  activePath?: string;
  /** Override for the logo + Home nav href. Pass the preview route URL when
   * rendering inside the editor preview iframe so the logo does not navigate
   * to the published public site. */
  homeHref?: string;
  /** Override for the Gallery nav href. Pass the preview route URL when
   * rendering inside the editor preview iframe so the link stays within the
   * draft-aware preview instead of navigating to the published public site. */
  galleryHref?: string;
  /** Custom brand-region content (the Navigation block's editable logo/title
   * slot) — replaces the default logo+brand-text link in the SAME row as the
   * nav links when provided. Absent = today's default rendering, unchanged. */
  brandSlot?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const logo = useImageRetry(config?.logoUrl);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const homeHref = homeHrefProp ?? `/w/${slug}`;
  const galleryHref = galleryHrefProp ?? `/w/${slug}/gallery`;
  const currentPath = activePath ?? pathname;
  const navbarSize = NAVBAR_SIZE_MAP[config?.navbarSize || "balanced"];

  const isHomeActive =
    currentPath === homeHref ||
    currentPath === `/w/${slug}/` ||
    (homeHref === "/" && currentPath === "/");
  const isGalleryActive = currentPath === galleryHref;

  const fontSize = config?.fontSize ? (FONT_SIZE_MAP[config.fontSize] ?? "0.9375rem") : "0.9375rem";
  const linkColor = resolveColor(config?.linkColor, "var(--pf-color-fg)");
  const brandTextColor = resolveColor(config?.brandTextColor, "var(--pf-color-fg)");
  const activeLinkColor = resolveColor(config?.activeLinkColor, "var(--pf-color-fg)");
  const shadow = config?.shadowSize ? (SHADOW_MAP[config.shadowSize] ?? "none") : "none";

  const borderBottomStyle = resolveHeaderBorderBottom(config);

  function getActiveLinkExtraStyle(): React.CSSProperties {
    const style: React.CSSProperties = { color: activeLinkColor };
    if (config?.activeLinkScale) {
      style.transform = "scale(1.08)";
      style.fontWeight = 700;
      style.display = "inline-flex";
    }
    if (config?.activeLinkHighlight) {
      const highlightColor = resolveColor(
        config.highlightColor,
        "var(--pf-color-fg)",
      );
      (style as React.CSSProperties & Record<string, string>)["--pf-active-link-highlight-fill"] = highlightColor;
      (style as React.CSSProperties & Record<string, string>)["--pf-active-link-highlight-opacity"] =
        `${config.highlightOpacity ?? 8}%`;
      style.backgroundColor = buildColorWithOpacity(highlightColor, config.highlightOpacity ?? 8);
      style.borderRadius = config.activeLinkRadius
        ? (RADIUS_MAP[config.activeLinkRadius] ?? "var(--pf-radius)")
        : "var(--pf-radius)";
    }
    // Effective default: undefined = ON (underline visible); only false explicitly disables it.
    if (config?.activeLinkUnderline !== false) {
      style.borderBottom = `3px solid ${resolveColor(config?.underlineColor, "var(--pf-color-accent)")}`;
    }
    return style;
  }

  const activeLinkExtra = getActiveLinkExtraStyle();
  const brandText = config && "brandText" in config ? config.brandText?.trim() ?? "" : labels.brand;

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
          padding: navbarSize.navPadding,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        {brandSlot ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {brandSlot}
          </div>
        ) : (
          <Link
            href={homeHref}
            style={{
              fontFamily: "var(--pf-font-heading)",
              color: brandTextColor,
              fontSize: navbarSize.brandFontSize,
              fontWeight: 700,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {config?.logoUrl && !logo.failed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.src}
                alt=""
                aria-hidden="true"
                onError={logo.onError}
                style={{ height: navbarSize.logoHeight, maxWidth: "40vw", width: "auto", objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {brandText}
            </span>
          </Link>
        )}

        <div className="pf-nav-desktop" style={{ alignItems: "center", gap: `clamp(0.25rem, 1.5vw, ${navbarSize.navGap})` }}>
          <HeaderLink
            href={homeHref}
            isActive={isHomeActive}
            linkColor={linkColor}
            fontSize={fontSize}
            activeStyle={activeLinkExtra}
            minHeight={navbarSize.linkMinHeight}
            paddingX={navbarSize.linkPaddingX}
          >
            {labels.home}
          </HeaderLink>
          <HeaderLink
            href={galleryHref}
            isActive={isGalleryActive}
            linkColor={linkColor}
            fontSize={fontSize}
            activeStyle={activeLinkExtra}
            minHeight={navbarSize.linkMinHeight}
            paddingX={navbarSize.linkPaddingX}
          >
            {labels.gallery}
          </HeaderLink>
          <ContactButton label={labels.contact} config={config} minHeight={navbarSize.contactMinHeight} />
        </div>

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
            backgroundColor: buildColorWithOpacity(
              resolveColor(config?.contactButtonColor, "var(--pf-color-primary)"),
              config?.contactButtonOpacity ?? 100,
            ),
            color: resolveColor(config?.contactButtonTextColor, "var(--pf-color-bg)"),
            border: "none",
            borderRadius: config?.contactButtonRadius
              ? (RADIUS_MAP[config.contactButtonRadius] ?? "var(--pf-radius)")
              : "var(--pf-radius)",
            cursor: "pointer",
            fontSize: "1.25rem",
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">{menuOpen ? "x" : "="}</span>
        </button>
      </nav>

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
            minHeight={navbarSize.linkMinHeight}
            paddingX={navbarSize.linkPaddingX}
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
            minHeight={navbarSize.linkMinHeight}
            paddingX={navbarSize.linkPaddingX}
          >
            {labels.gallery}
          </HeaderLink>
          <ContactButton
            label={labels.contact}
            block
            config={config}
            onActivate={() => setMenuOpen(false)}
            minHeight={navbarSize.contactMinHeight}
          />
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
        @media (max-width: 400px) {
          .pf-nav-link { padding-left: 0.375rem !important; padding-right: 0.375rem !important; }
        }
        @media (max-width: 375px) {
          .pf-nav-mobile { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
        }
        @media (max-width: 768px) {
          .pf-nav-contact { min-width: 0; padding-left: 0.625rem !important; padding-right: 0.625rem !important; }
        }
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
  minHeight,
  paddingX,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate?: () => void;
  block?: boolean;
  isActive?: boolean;
  linkColor: string;
  fontSize: string;
  activeStyle: React.CSSProperties;
  minHeight: string;
  paddingX: string;
}) {
  const baseStyle: React.CSSProperties = {
    display: block ? "flex" : "inline-flex",
    alignItems: "center",
    justifyContent: block ? "center" : undefined,
    minHeight,
    padding: `0 ${paddingX}`,
    color: linkColor,
    textDecoration: "none",
    fontSize,
    fontFamily: "var(--pf-font-body)",
    borderRadius: "var(--pf-radius)",
    borderBottom: "3px solid transparent",
    transition: "background-color 0.15s",
  };
  return (
    <Link href={href} onClick={onNavigate} className="pf-nav-link" style={isActive ? { ...baseStyle, ...activeStyle } : baseStyle}>
      {children}
    </Link>
  );
}

function ContactButton({
  label,
  block,
  onActivate,
  config,
  minHeight,
}: {
  label: string;
  block?: boolean;
  onActivate?: () => void;
  config?: PortfolioHeaderConfig | null;
  minHeight: string;
}) {
  function handleClick() {
    onActivate?.();
    if (typeof window !== "undefined") {
      window.__gallurioOpenContact?.();
    }
  }

  const contactButtonFill = resolveColor(config?.contactButtonColor, "var(--pf-color-primary)");
  const contactButtonStyle: React.CSSProperties & Record<string, string | number | undefined> = {
    "--pf-contact-button-fill": contactButtonFill,
    "--pf-contact-button-opacity": `${config?.contactButtonOpacity ?? 100}%`,
    display: block ? "block" : "inline-flex",
    width: block ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    minHeight,
    minWidth: 0,
    padding: "0 1rem",
    marginTop: block ? "0.25rem" : 0,
    backgroundColor: buildColorWithOpacity(contactButtonFill, config?.contactButtonOpacity ?? 100),
    color: resolveColor(config?.contactButtonTextColor, "var(--pf-color-bg)"),
    border: "none",
    borderRadius: config?.contactButtonRadius
      ? (RADIUS_MAP[config.contactButtonRadius] ?? "var(--pf-radius)")
      : "var(--pf-radius)",
    cursor: "pointer",
    fontSize: config?.fontSize ? (FONT_SIZE_MAP[config.fontSize] ?? "0.9375rem") : "0.9375rem",
    fontFamily: "var(--pf-font-body)",
  };

  return (
    <button
      type="button"
      data-cta="contact"
      className="pf-nav-contact"
      onClick={handleClick}
      style={contactButtonStyle}
    >
      {label}
    </button>
  );
}
