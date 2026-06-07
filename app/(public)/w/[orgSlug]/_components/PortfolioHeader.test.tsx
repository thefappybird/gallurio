import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PortfolioHeader, type PortfolioHeaderLabels } from "./PortfolioHeader";

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
});
