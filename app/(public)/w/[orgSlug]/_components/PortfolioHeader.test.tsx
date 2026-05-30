import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PortfolioHeader, type PortfolioHeaderLabels } from "./PortfolioHeader";

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
});
