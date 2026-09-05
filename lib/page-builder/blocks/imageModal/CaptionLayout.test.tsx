import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CaptionLayout } from "./CaptionLayout";
import type { ImageModalLeafProps, LightboxImage } from "../Lightbox";

const OLD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD;
});

function img(id: string, extra: Partial<LightboxImage> = {}): LightboxImage {
  return { id, publicId: `workspace/${id}`, alt: `Photo ${id}`, ...extra };
}

function baseProps(overrides: Partial<ImageModalLeafProps> = {}): ImageModalLeafProps {
  const image = overrides.image ?? img("a");
  const images = overrides.images ?? [image];
  return {
    image,
    images,
    index: 0,
    total: images.length,
    hasNav: images.length > 1,
    canGoPrev: false,
    canGoNext: false,
    isPendingMore: false,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    closeLabel: "Close",
    fullSizeAlt: "Full size photo",
    prevLabel: "Previous image",
    nextLabel: "Next image",
    counterText: "1 / 1",
    filmstripLabel: "Photo filmstrip",
    seeMoreLabel: "See more",
    seeLessLabel: "See less",
    dotLabelTemplate: "Photo {current} of {total}",
    ...overrides,
  };
}

describe("CaptionLayout — see-more metadata panel", () => {
  it("keeps facts/meta/tags hidden until the see-more toggle is activated", () => {
    const image = img("a", {
      date: "2026-06-01",
      location: "Manila",
      client: "Cruz Wedding",
      meta: [{ label: "Camera", value: "GFX100" }],
      tags: ["wedding"],
    });
    render(<CaptionLayout {...baseProps({ image })} />);

    expect(screen.queryByText("Manila")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See more" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    expect(screen.getByText("Manila")).toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();
    expect(screen.getByText("GFX100")).toBeInTheDocument();
    expect(screen.getByText("wedding")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "See less" }));
    expect(screen.queryByText("Manila")).not.toBeInTheDocument();
  });

  it("renders no toggle and no bottom block when there is no caption, nav, or metadata", () => {
    render(<CaptionLayout {...baseProps({ image: img("a") })} />);
    expect(screen.queryByRole("button", { name: "See more" })).not.toBeInTheDocument();
  });

  it("shows the toggle even without title/caption when metadata alone is present", () => {
    const image = img("a", { location: "Manila" });
    render(<CaptionLayout {...baseProps({ image })} />);
    expect(screen.getByRole("button", { name: "See more" })).toBeInTheDocument();
  });
});

describe("CaptionLayout — expanded panel stays under the dots/counter", () => {
  it("keeps the dot-pagination row's z-index above the expanded see-more panel's", () => {
    const images = [img("a", { location: "Manila" }), img("b"), img("c")];
    render(
      <CaptionLayout
        {...baseProps({ image: images[0], images, index: 0, total: 3, hasNav: true })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    const dotsRow = document.querySelector(".pf-modal-caption-dots") as HTMLElement;
    const panelId = screen.getByRole("button", { name: "See less" }).getAttribute("aria-controls");
    const panel = document.getElementById(panelId!)!;

    expect(dotsRow.style.position).toBe("relative");
    expect(Number(dotsRow.style.zIndex)).toBeGreaterThan(Number(panel.style.zIndex));
  });

  it("keeps the numeric counter's z-index above the expanded see-more panel's when total > 8", () => {
    const images = Array.from({ length: 9 }, (_, i) => img(`p${i}`, i === 0 ? { location: "Manila" } : {}));
    render(
      <CaptionLayout
        {...baseProps({ image: images[0], images, index: 0, total: 9, hasNav: true, counterText: "1 / 9" })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    const counter = screen.getByText("1 / 9");
    const panelId = screen.getByRole("button", { name: "See less" }).getAttribute("aria-controls");
    const panel = document.getElementById(panelId!)!;

    expect(counter.style.position).toBe("relative");
    expect(Number(counter.style.zIndex)).toBeGreaterThan(Number(panel.style.zIndex));
  });
});

describe("CaptionLayout — dot pagination", () => {
  it("renders one clickable dot per photo when total <= 8, marking the current one", () => {
    const images = [img("a"), img("b"), img("c")];
    const onSelect = vi.fn();
    render(<CaptionLayout {...baseProps({ image: images[0], images, index: 0, total: 3, hasNav: true, onSelect })} />);

    const dots = [
      screen.getByRole("button", { name: "Photo 1 of 3" }),
      screen.getByRole("button", { name: "Photo 2 of 3" }),
      screen.getByRole("button", { name: "Photo 3 of 3" }),
    ];
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).not.toHaveAttribute("aria-current");

    fireEvent.click(dots[2]);
    expect(onSelect).toHaveBeenCalledWith(2);

    // No numeric counter text alongside the dots.
    expect(screen.queryByText("1 / 3")).not.toBeInTheDocument();
  });

  it("keeps the numeric counter, not dots, when total > 8", () => {
    const images = Array.from({ length: 9 }, (_, i) => img(`p${i}`));
    render(
      <CaptionLayout
        {...baseProps({ image: images[0], images, index: 0, total: 9, hasNav: true, counterText: "1 / 9" })}
      />
    );

    expect(screen.getByText("1 / 9")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Photo \d+ of 9/ })).not.toBeInTheDocument();
  });
});
