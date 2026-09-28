import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImmersiveViewer } from "./ImmersiveViewer";
import type { LightboxImage } from "./Lightbox";

const OLD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD;
});

function images(n: number): LightboxImage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id${i}`,
    publicId: `pid${i}`,
    alt: `Photo ${i}`,
  }));
}

function baseProps(list: LightboxImage[], index = 0) {
  return {
    image: list[index],
    images: list,
    index,
    canGoPrev: index > 0,
    canGoNext: index < list.length - 1,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onSelect: vi.fn(),
    previousLabel: "Previous",
    nextLabel: "Next",
    filmstripLabel: "Photo filmstrip",
    dotLabelTemplate: "Photo {current} of {total}",
    showDots: false,
  };
}

describe("ImmersiveViewer — filmstrip virtualization", () => {
  it("mounts 200 images but renders far fewer thumbnail <img>s in the DOM", () => {
    const list = images(200);
    const { container } = render(<ImmersiveViewer {...baseProps(list)} />);
    const thumbs = container.querySelectorAll("[data-immersive-thumb]");
    expect(thumbs.length).toBeGreaterThan(0);
    expect(thumbs.length).toBeLessThan(200);
  });

  it("keeps data-immersive-thumb selection working for a rendered (visible) row", () => {
    const list = images(200);
    const onSelect = vi.fn();
    render(<ImmersiveViewer {...baseProps(list)} onSelect={onSelect} />);
    const firstThumb = screen.getAllByRole("option")[0];
    fireEvent.click(firstThumb);
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("keeps roving tabIndex (selected=0, others=-1) among rendered rows", () => {
    const list = images(200);
    render(<ImmersiveViewer {...baseProps(list, 0)} />);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("tabindex", "0");
    expect(options.slice(1).every((el) => el.getAttribute("tabindex") === "-1")).toBe(true);
  });
});
