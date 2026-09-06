import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SheetLayout } from "./SheetLayout";
import type { ImageModalLeafProps, LightboxImage } from "../Lightbox";

// lucide-react path `d` data — the only reliable way to tell ChevronLeftIcon
// from ChevronRightIcon apart in the rendered DOM.
const CHEVRON_LEFT_D = "m15 18-6-6 6-6";
const CHEVRON_RIGHT_D = "m9 18 6-6-6-6";

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
    additionalInformationLabel: "Additional information",
    dotLabelTemplate: "Photo {current} of {total}",
    dir: "ltr",
    ...overrides,
  };
}

describe("SheetLayout — sticky nav footer", () => {
  it("renders the nav row after the metadata content in DOM order, sticky at the sheet bottom", () => {
    const image = img("a", { title: "Golden Hour", caption: "A quiet moment." });
    const images = [image, img("b")];
    render(
      <SheetLayout {...baseProps({ image, images, index: 0, total: 2, hasNav: true, counterText: "1 / 2" })} />
    );

    const heading = screen.getByRole("heading", { name: "Golden Hour" });
    const prevButton = screen.getByRole("button", { name: "Previous image" });

    // Nav row must come after the metadata content in DOM order.
    expect(heading.compareDocumentPosition(prevButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const navRow = prevButton.closest("div");
    expect(navRow).toHaveStyle({ position: "sticky", bottom: "0px" });
    expect(navRow?.style.zIndex).toBe("2");
    expect(navRow?.style.backdropFilter).toBe("blur(12px)");
  });

  it("still renders a functional prev/counter/next row when caption/meta/tags are absent", () => {
    const images = [img("a"), img("b")];
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <SheetLayout
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
    render(<SheetLayout {...baseProps({ hasNav: false })} />);
    expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();
  });

  it("groups primary and additional data into a two-column metadata layout", () => {
    render(<SheetLayout {...baseProps({ image: img("a", { title: "Golden Hour", location: "Tagaytay", meta: [{ label: "Venue", value: "The Farm" }] }) })} />);
    expect(screen.getByRole("heading", { name: "Additional information" })).toBeInTheDocument();
    const css = document.querySelector("style")?.textContent ?? "";
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).not.toContain("repeat(3, 1fr)");
  });
});

describe("SheetLayout — dir (RTL)", () => {
  it("swaps the prev/next chevrons under dir='rtl'", () => {
    const images = [img("a"), img("b")];
    render(
      <SheetLayout {...baseProps({ image: images[0], images, index: 0, total: 2, hasNav: true, dir: "rtl" })} />
    );
    const prevBtn = screen.getByRole("button", { name: "Previous image" });
    const nextBtn = screen.getByRole("button", { name: "Next image" });
    expect(prevBtn.querySelector("path")).toHaveAttribute("d", CHEVRON_RIGHT_D);
    expect(nextBtn.querySelector("path")).toHaveAttribute("d", CHEVRON_LEFT_D);
  });
});
