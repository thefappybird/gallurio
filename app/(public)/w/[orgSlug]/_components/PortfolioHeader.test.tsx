import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  PortfolioHeader,
  resolveHeaderBorderBottom,
  type PortfolioHeaderLabels,
} from "./PortfolioHeader";
import { PORTFOLIO_TEMPLATES } from "@/lib/page-builder/templates";
import type { PortfolioHeaderConfig } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "@/lib/page-builder/templates/types";

/** Each template no longer carries `defaultHeader` — its header look now lives
 *  on the Navigation block seeded first into the home zone. */
function templateNavConfig(template: PortfolioTemplate): PortfolioHeaderConfig {
  const data = template.seedData({ workspace: { name: "Test Studio" } });
  const nav = data.home?.content.find((b) => b.type === "Navigation");
  return (nav?.props ?? {}) as PortfolioHeaderConfig;
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/w/luna-studio",
}));

const labels: PortfolioHeaderLabels = {
  brand: "Luna Studio",
  navLandmark: "Portfolio",
  home: "Home",
  gallery: "Gallery",
  contact: "Contact",
  openMenu: "Open menu",
  closeMenu: "Close menu",
};

describe("PortfolioHeader", () => {
  it("renders a labelled Portfolio nav", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    expect(screen.getByRole("navigation", { name: "Portfolio" })).toBeInTheDocument();
  });

  it("clamps the inner nav row to 80rem by default (preserves today's rendering for callers that omit overallWidth)", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    const nav = screen.getByRole("navigation", { name: "Portfolio" });
    expect(nav.style.maxWidth).toBe("80rem");
    expect(nav.style.margin).toBe("0px auto");
  });

  it("overallWidth='full' drops the inner nav row's 80rem clamp", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} overallWidth="full" />);
    const nav = screen.getByRole("navigation", { name: "Portfolio" });
    expect(nav.style.maxWidth).toBe("");
    expect(nav.style.margin).toBe("");
  });

  it("links Home and Gallery to the correct workspace URLs", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    const nav = screen.getByRole("navigation", { name: "Portfolio" });
    const home = within(nav).getByRole("link", { name: "Home" });
    const gallery = within(nav).getByRole("link", { name: "Gallery" });
    expect(home).toHaveAttribute("href", "/w/luna-studio");
    expect(gallery).toHaveAttribute("href", "/w/luna-studio/gallery");
  });

  it("renders a Contact button carrying data-cta=contact for the modal delegate", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    const contact = screen.getByRole("button", { name: "Contact" });
    expect(contact).toHaveAttribute("data-cta", "contact");
  });

  it("applies configured contact button color, opacity, radius, and text color", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        config={{
          contactButtonColor: "accent",
          contactButtonOpacity: 64,
          contactButtonRadius: "rounded",
          contactButtonTextColor: "foreground",
        }}
      />,
    );
    const contact = screen.getByRole("button", { name: "Contact" });
    expect(contact.getAttribute("style")).toContain("--pf-contact-button-fill: var(--pf-color-accent)");
    expect(contact.getAttribute("style")).toContain("--pf-contact-button-opacity: 64%");
    expect(contact.style.borderRadius).toBe("0.5rem");
    expect(contact.style.color).toBe("var(--pf-color-fg)");
  });

  it("applies active-link highlight opacity and radius to the current page", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        config={{
          activeLinkHighlight: true,
          highlightColor: "accent",
          highlightOpacity: 45,
          activeLinkRadius: "rounded",
        }}
      />,
    );
    const home = screen.getByRole("link", { name: "Home" });
    expect(home.getAttribute("style")).toContain("--pf-active-link-highlight-fill: var(--pf-color-accent)");
    expect(home.getAttribute("style")).toContain("--pf-active-link-highlight-opacity: 45%");
    expect(home.style.borderRadius).toBe("0.5rem");
  });

  it("respects an explicit active path override for preview surfaces", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        activePath="/w/luna-studio/gallery"
        config={{ activeLinkColor: "accent" }}
      />
    );

    expect(screen.getByRole("link", { name: "Gallery" }).style.color).toBe("var(--pf-color-accent)");
    expect(screen.getByRole("link", { name: "Home" }).style.color).toBe("var(--pf-color-fg)");
  });

  it("supports flashy navbar sizing", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        config={{ navbarSize: "flashy" }}
      />
    );

    expect(screen.getByRole("link", { name: "Luna Studio" }).style.fontSize).toBe("1.375rem");
    expect(screen.getByRole("button", { name: "Contact" }).style.minHeight).toBe("52px");
  });

  it("uses a dedicated heading color when configured", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        config={{ linkColor: "foreground", brandTextColor: "accent" }}
      />
    );

    expect(screen.getByRole("link", { name: "Luna Studio" }).style.color).toBe("var(--pf-color-accent)");
    expect(screen.getByRole("link", { name: "Home" }).style.color).toBe("var(--pf-color-fg)");
  });

  it("opens contact directly from the header button", () => {
    window.__gallurioOpenContact = vi.fn();

    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact" }));

    expect(window.__gallurioOpenContact).toHaveBeenCalledTimes(1);
  });

  it("exposes an accessible menu toggle that flips aria-expanded", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    const toggle = screen.getByLabelText("Open menu");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Close menu")).toHaveAttribute("aria-expanded", "true");
  });

  it("opens a mobile panel with the same nav targets", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    // After opening, Home appears in both the desktop and mobile lists.
    const homeLinks = screen.getAllByRole("link", { name: "Home", hidden: true });
    expect(homeLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the brand heading empty when brandText is intentionally empty", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} config={{ brandText: "" }} />);
    expect(screen.queryByRole("link", { name: "Luna Studio" })).not.toBeInTheDocument();
  });

  it("preview mode: uses homeHref prop for logo and Home nav instead of /w/slug", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        homeHref="/en/portfolio-preview"
      />
    );
    const logoLink = screen.getByRole("link", { name: "Luna Studio" });
    expect(logoLink).toHaveAttribute("href", "/en/portfolio-preview");
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveAttribute("href", "/en/portfolio-preview");
  });

  it("uses the floated foreground at 8% for an unset active-link highlight", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        config={{ activeLinkHighlight: true }}
      />,
    );
    const home = screen.getByRole("link", { name: "Home" });
    expect(home.getAttribute("style")).toContain(
      "--pf-active-link-highlight-fill: var(--pf-color-fg)",
    );
    expect(home.getAttribute("style")).toContain(
      "--pf-active-link-highlight-opacity: 8%",
    );
  });

  it("uses the tenant root for Home and marks it active when public href overrides are provided", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        homeHref="/"
        galleryHref="/gallery"
        activePath="/"
      />,
    );
    const nav = screen.getByRole("navigation", { name: labels.navLandmark });
    const home = within(nav).getByRole("link", { name: "Home" });
    const gallery = within(nav).getByRole("link", { name: "Gallery" });
    expect(home).toHaveAttribute("href", "/");
    expect(gallery).toHaveAttribute("href", "/gallery");
    expect(home.style.borderBottomColor).not.toBe("transparent");
    expect(gallery.style.borderBottomColor).toBe("transparent");
  });

  it("brand link has minWidth:0 and overflow:hidden to prevent hamburger push-off at narrow viewports", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    const brandLink = screen.getByRole("link", { name: "Luna Studio" });
    expect(brandLink.style.minWidth).toBe("0");
    expect(brandLink.style.overflow).toBe("hidden");
  });

  it("mobile drawer nav links are horizontally centered", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    const drawerLinks = screen.getAllByRole("link", { name: "Home", hidden: true });
    // The mobile drawer link is a flex container with justifyContent: center
    const drawerHomeLink = drawerLinks.find((el) => el.closest(".pf-nav-mobile"));
    expect(drawerHomeLink).toBeTruthy();
    expect(drawerHomeLink!.style.justifyContent).toBe("center");
    expect(drawerHomeLink!.style.display).toBe("flex");
  });

  it("hamburger toggle inherits contact button fill, text color, and radius from config", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        config={{
          contactButtonColor: "accent",
          // opacity 100 → no color-mix(), so happy-dom can parse the CSS var
          contactButtonOpacity: 100,
          contactButtonRadius: "rounded",
          contactButtonTextColor: "foreground",
        }}
      />,
    );
    const toggle = screen.getByLabelText("Open menu");
    expect(toggle.style.backgroundColor).toBe("var(--pf-color-accent)");
    expect(toggle.style.color).toBe("var(--pf-color-fg)");
    expect(toggle.style.borderRadius).toBe("0.5rem");
    // no border — the original had a visible border; the new toggle uses border:none
    expect(toggle.style.borderStyle).not.toBe("solid");
  });

  it("preview mode: uses galleryHref prop for Gallery nav instead of /w/slug/gallery", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        galleryHref="/en/portfolio-preview?zone=gallery"
      />
    );
    const galleryLinks = screen.getAllByRole("link", { name: "Gallery" });
    expect(galleryLinks.length).toBeGreaterThan(0);
    expect(galleryLinks[0]).toHaveAttribute("href", "/en/portfolio-preview?zone=gallery");
  });

  it("preview mode: gallery falls back to /w/slug/gallery when galleryHref is omitted", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    const galleryLinks = screen.getAllByRole("link", { name: "Gallery" });
    expect(galleryLinks[0]).toHaveAttribute("href", "/w/luna-studio/gallery");
  });

  // C2: active-link underline effective default — undefined must show the underline
  it("active link shows underline by default (no config = effective default ON)", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    const homeLink = screen.getByRole("link", { name: "Home" });
    // happy-dom parses the border shorthand — check the individual borderBottomColor
    // is the accent token, NOT transparent
    expect(homeLink.style.borderBottomColor).not.toBe("transparent");
    expect(homeLink.getAttribute("style")).toContain("--pf-color-accent");
  });

  // Regression: brandTextColor must not bleed linkColor — unset brandTextColor should
  // always resolve to var(--pf-color-fg), regardless of what linkColor is set to.
  it("unset brandTextColor falls back to fg token, not linkColor (bleed regression)", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        config={{ linkColor: "accent" }}
      />,
    );
    // Brand heading must use fg (not accent), even though linkColor is accent
    expect(screen.getByRole("link", { name: "Luna Studio" }).style.color).toBe("var(--pf-color-fg)");
    // Gallery is inactive so it uses linkColor, not activeLinkColor
    expect(screen.getByRole("link", { name: "Gallery" }).style.color).toBe("var(--pf-color-accent)");
  });
  it("renders brandSlot content in place of the default logo/text link when provided", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        brandSlot={<div data-testid="brand-slot">Custom brand</div>}
      />,
    );
    expect(screen.getByTestId("brand-slot")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Luna Studio" })).not.toBeInTheDocument();
  });

  it("keeps brandSlot content in the same row (same nav) as the Home/Gallery links", () => {
    render(
      <PortfolioHeader
        slug="luna-studio"
        labels={labels}
        brandSlot={<div data-testid="brand-slot">Custom brand</div>}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Portfolio" });
    expect(within(nav).getByTestId("brand-slot")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("without brandSlot renders the default logo/brand-text link exactly as before", () => {
    render(<PortfolioHeader slug="luna-studio" labels={labels} />);
    expect(screen.getByRole("link", { name: "Luna Studio" })).toBeInTheDocument();
  });
});

describe("PortfolioHeader template render contract", () => {
  const tokenVar = (token: string | undefined, fallback: string) =>
    token ? `var(--pf-color-${token === "background" ? "bg" : token === "foreground" ? "fg" : token})` : fallback;

  it.each(PORTFOLIO_TEMPLATES)(
    "$id renders every seeded header value and effective fallback",
    (template) => {
      const config = templateNavConfig(template);
      render(
        <PortfolioHeader
          slug="luna-studio"
          labels={labels}
          config={config}
          activePath="/w/luna-studio"
        />,
      );

      const header = document.querySelector("header") as HTMLElement;
      const home = screen.getByRole("link", { name: "Home" });
      const contact = screen.getByRole("button", { name: "Contact" });

      expect(header.style.backgroundColor).toBe(
        tokenVar(config.backgroundColor, "var(--pf-color-bg)"),
      );
      expect(resolveHeaderBorderBottom(config)).toContain(
        `${config.borderBottomWidth ?? 1}px solid`,
      );
      expect(home.style.fontSize).toBe(
        config.fontSize === "sm"
          ? "0.8125rem"
          : config.fontSize === "lg"
            ? "1.0625rem"
            : "0.9375rem",
      );
      expect(home.style.color).toBe(
        tokenVar(config.activeLinkColor, "var(--pf-color-fg)"),
      );
      expect(home.style.transform).toBe(
        config.activeLinkScale ? "scale(1.08)" : "",
      );
      expect(home.style.borderBottomColor === "transparent").toBe(
        config.activeLinkUnderline === false,
      );
      expect(
        (home.getAttribute("style") ?? "").includes(
          "--pf-active-link-highlight-fill",
        ),
      ).toBe(Boolean(config.activeLinkHighlight));
      expect(contact.style.backgroundColor).toBe(
        tokenVar(config.contactButtonColor, "var(--pf-color-primary)"),
      );
      expect(contact.style.color).toBe(
        tokenVar(config.contactButtonTextColor, "var(--pf-color-bg)"),
      );
      expect(contact.style.borderRadius).toBe(
        config.contactButtonRadius === "sharp"
          ? "0px"
          : config.contactButtonRadius === "subtle"
            ? "0.25rem"
            : config.contactButtonRadius === "rounded"
              ? "0.5rem"
              : "var(--pf-radius)",
      );

      if (config.activeLinkHighlight) {
        expect(home.getAttribute("style")).toContain(
          `--pf-active-link-highlight-opacity: ${config.highlightOpacity ?? 8}%`,
        );
      }
    },
  );
});
