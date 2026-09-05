import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarLayout } from "./SidebarLayout";
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

describe("SidebarLayout — sticky nav footer", () => {
  it("renders the nav row after the metadata content in DOM order, sticky at the panel bottom", () => {
    const image = img("a", { title: "Golden Hour", caption: "A quiet moment." });
    const images = [image, img("b")];
    render(
      <SidebarLayout {...baseProps({ image, images, index: 0, total: 2, hasNav: true, counterText: "1 / 2" })} />
    );

    const heading = screen.getByRole("heading", { name: "Golden Hour" });
    const prevButton = screen.getByRole("button", { name: "Previous image" });

    // Nav row must come after the metadata content in DOM order.
    expect(heading.compareDocumentPosition(prevButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const navRow = prevButton.closest("div");
    expect(navRow).toHaveStyle({ position: "sticky", bottom: "0px" });
  });

  it("still renders a functional prev/counter/next row when facts/meta/tags are absent", () => {
    const images = [img("a"), img("b")];
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <SidebarLayout
        {...baseProps({
          image: images[0],
          images,
          index: 0,
          total: 2,
          hasNav: true,
          canGoPrev: false,
          canGoNext: true,
          counterText: "1 / 2",
          onPrev,
          onNext,
        })}
      />
    );

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    const prevButton = screen.getByRole("button", { name: "Previous image" });
    const nextButton = screen.getByRole("button", { name: "Next image" });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("renders no nav row when hasNav is false", () => {
    render(<SidebarLayout {...baseProps({ hasNav: false })} />);
    expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();
  });
});
