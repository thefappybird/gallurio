import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import type { DiscoverDetail } from "@/lib/db/queries/discover";
import { DiscoverDialog } from "./discover-dialog";

const image = (n: number) => ({ url: `https://img.test/${n}.jpg`, width: 1600, height: 1000, alt: `Photo ${n}` });

const detail: DiscoverDetail = {
  slug: "marlowe-vale",
  name: "Marlowe & Vale",
  category: "photographer",
  country: "PH",
  pitch: "Unhurried wedding photography.",
  cover: { url: "https://img.test/cover.jpg", width: 400, height: 500 },
  brand: { bg: "#1f3a34", fg: "#f1efe6", accent: "#e0b873", headingFont: "fraunces" },
  images: [image(1), image(2), image(3)],
};

describe("DiscoverDialog", () => {
  it("advances on ArrowRight in LTR", () => {
    renderWithProviders(<DiscoverDialog detail={detail} open onOpenChange={() => {}} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Next image" }), { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("goes back on ArrowRight in RTL", () => {
    renderWithProviders(
      <div dir="rtl">
        <DiscoverDialog detail={detail} open onOpenChange={() => {}} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "Next image" }), { key: "ArrowRight" });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("hides thumbnails, arrows and counter for a single image but shows them for several", () => {
    const single = { ...detail, images: [image(1)] };
    const { rerender } = renderWithProviders(<DiscoverDialog detail={single} open onOpenChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /Show image/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next image" })).toBeNull();
    expect(screen.queryByText("1 / 1")).toBeNull();

    rerender(<DiscoverDialog detail={detail} open onOpenChange={() => {}} />);
    expect(screen.getAllByRole("button", { name: /Show image/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Next image" })).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("links Visit portfolio to the public portfolio URL in a new tab", () => {
    renderWithProviders(<DiscoverDialog detail={detail} open onOpenChange={() => {}} />);

    const visit = screen.getByRole("link", { name: /Visit portfolio/ });
    expect(visit).toHaveAttribute("href", portfolioPublicUrl("marlowe-vale"));
    expect(visit).toHaveAttribute("target", "_blank");
    expect(visit.getAttribute("rel")).toContain("noopener");
  });
});
