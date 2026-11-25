import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import type { DiscoverCard } from "@/lib/db/queries/discover";
import { DiscoverTile } from "./discover-tile";

const card: DiscoverCard = {
  slug: "marlowe-vale",
  name: "Marlowe & Vale",
  category: "photographer",
  country: "PH",
  pitch: "",
  cover: { url: "https://img.test/a.jpg", width: 400, height: 500 },
  brand: { bg: "#1f3a34", fg: "#f1efe6", accent: "#e0b873", headingFont: "fraunces" },
};

describe("DiscoverTile", () => {
  it("is an image-only link to ?p=slug labelled with the name and category line, with overlay text", () => {
    renderWithProviders(<DiscoverTile card={card} onOpen={() => {}} />);

    const link = screen.getByRole("link", { name: "Marlowe & Vale, Photographer · Philippines" });
    expect(link).toHaveAttribute("href", "?p=marlowe-vale");
    expect(screen.getByText("Marlowe & Vale")).toBeInTheDocument();
    expect(screen.getByText("Photographer · Philippines")).toBeInTheDocument();
  });

  it("leaves out the separator when there is no country or no category", () => {
    const { container, rerender } = renderWithProviders(
      <DiscoverTile card={{ ...card, country: null }} onOpen={() => {}} />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("aria-label", "Marlowe & Vale, Photographer");
    expect(container.textContent).not.toContain("·");

    rerender(<DiscoverTile card={{ ...card, category: null }} onOpen={() => {}} />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-label", "Marlowe & Vale, Philippines");
    expect(container.textContent).not.toContain("·");
  });

  it("renders no link and no overlay, and is hidden from assistive tech, when decorative", () => {
    const { container } = renderWithProviders(<DiscoverTile card={card} decorative />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).toBe("");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("dims a brand tile and overlays the name and category line on hover and focus, like a cover tile", () => {
    const { container } = renderWithProviders(<DiscoverTile card={{ ...card, cover: null }} onOpen={() => {}} />);

    expect(container.querySelector("[data-brand-tile]")).toHaveClass(
      "group-hover:opacity-35",
      "group-focus-visible:opacity-35",
    );
    const overlay = container.querySelector("[data-tile-overlay]");
    expect(overlay).toHaveClass("group-hover:opacity-100", "group-focus-visible:opacity-100");
    expect(overlay).toHaveTextContent("Marlowe & Vale");
    expect(overlay).toHaveTextContent("Photographer · Philippines");
  });

  it("makes the brand tile root the size container so cqw units track the tile width", () => {
    const { container } = renderWithProviders(<DiscoverTile card={{ ...card, cover: null }} onOpen={() => {}} />);

    expect(container.querySelector("[data-brand-tile]")).toHaveStyle({ containerType: "inline-size" });
  });

  it("has no hover dim or overlay on a decorative brand tile", () => {
    const { container } = renderWithProviders(<DiscoverTile card={{ ...card, cover: null }} decorative />);

    expect(container.querySelector("[data-brand-tile]")).not.toHaveClass("group-hover:opacity-35");
    expect(container.querySelector("[data-tile-overlay]")).toBeNull();
  });

  it("swaps a broken cover image for the brand tile", () => {
    const { container } = renderWithProviders(<DiscoverTile card={card} onOpen={() => {}} />);
    expect(container.querySelector("[data-brand-tile]")).toBeNull();

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-brand-tile]")).toHaveStyle({ backgroundColor: "#1f3a34" });
  });
});
