"use client";

/**
 * Sticky public-portfolio navigation shown on both Home and Gallery.
 *
 * - Home / Gallery are real links; Contact is a `<button data-cta="contact">`
 *   that the layout's click-delegate (Phase 5) wires to the contact modal.
 * - Brand-kit styled via the `--pf-*` CSS variables set by the public layout.
 * - Mobile: a hamburger toggles a slide-out panel that closes on link tap.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export type PortfolioHeaderLabels = {
  brand: string;
  /** Localized landmark label for the <nav>. */
  navLandmark: string;
  home: string;
  gallery: string;
  contact: string;
  openMenu: string;
  closeMenu: string;
};

export function PortfolioHeader({
  slug,
  labels,
}: {
  slug: string;
  labels: PortfolioHeaderLabels;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu if the viewport grows to desktop width.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const homeHref = `/w/${slug}`;
  const galleryHref = `/w/${slug}/gallery`;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "var(--pf-color-bg)",
        borderBottom: "1px solid color-mix(in srgb, var(--pf-color-fg) 14%, transparent)",
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
            color: "var(--pf-color-fg)",
            fontSize: "1.125rem",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {labels.brand}
        </Link>

        {/* Desktop links */}
        <div className="pf-nav-desktop" style={{ alignItems: "center", gap: "0.5rem" }}>
          <HeaderLink href={homeHref}>{labels.home}</HeaderLink>
          <HeaderLink href={galleryHref}>{labels.gallery}</HeaderLink>
          <ContactButton label={labels.contact} />
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
          <HeaderLink href={homeHref} onNavigate={() => setMenuOpen(false)} block>
            {labels.home}
          </HeaderLink>
          <HeaderLink href={galleryHref} onNavigate={() => setMenuOpen(false)} block>
            {labels.gallery}
          </HeaderLink>
          <ContactButton label={labels.contact} block onActivate={() => setMenuOpen(false)} />
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
}: {
  href: string;
  children: React.ReactNode;
  onNavigate?: () => void;
  block?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="pf-nav-link"
      style={{
        display: block ? "block" : "inline-flex",
        alignItems: "center",
        minHeight: "44px",
        padding: "0 0.75rem",
        color: "var(--pf-color-fg)",
        textDecoration: "none",
        fontSize: "0.9375rem",
        borderRadius: "var(--pf-radius)",
      }}
    >
      {children}
    </Link>
  );
}

function ContactButton({
  label,
  block,
  onActivate,
}: {
  label: string;
  block?: boolean;
  onActivate?: () => void;
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
        fontSize: "0.9375rem",
        fontFamily: "var(--pf-font-body)",
      }}
    >
      {label}
    </button>
  );
}
