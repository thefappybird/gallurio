import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { HeroBlock, heroDefaultProps } from "./HeroBlock";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string, opts: { width?: number }) =>
      `https://res.cloudinary.com/test/image/upload/c_fill,w_${opts?.width ?? 400},h_${opts?.width ?? 400},q_auto,f_auto/${publicId}`
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderHero(overrides: Partial<typeof heroDefaultProps> = {}) {
  return render(<HeroBlock {...heroDefaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("HeroBlock — renders with default props", () => {
  it("renders without crashing", () => {
    const { container } = renderHero();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders the headline text", () => {
    renderHero({ headline: "Test Headline" });
    expect(screen.getByText("Test Headline")).toBeInTheDocument();
  });

  it("renders the subhead when provided", () => {
    renderHero({ subhead: "Fine art photography" });
    expect(screen.getByText("Fine art photography")).toBeInTheDocument();
  });

  it("renders the primary CTA button", () => {
    renderHero({ primaryCtaLabel: "Contact Us" });
    expect(screen.getByText("Contact Us")).toBeInTheDocument();
  });

  it("renders data-block=hero marker", () => {
    const { container } = renderHero();
    expect(container.querySelector("[data-block='hero']")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Brand-kit CSS variables
// ---------------------------------------------------------------------------

describe("HeroBlock — brand-kit CSS variables", () => {
  it("accent gradient references var(--pf-color-accent) when no background image", () => {
    const { container } = renderHero({
      backgroundImagePublicId: "",
      backgroundImageUrl: "",
    });
    const section = container.querySelector("[data-block='hero']") as HTMLElement;
    expect(section).not.toBeNull();
    // When no image, background linear-gradient references accent var
    expect(section.style.background).toContain("var(--pf-color-accent)");
  });

  it("heading uses var(--pf-font-heading) font-family", () => {
    const { container } = renderHero({ headline: "Font Test" });
    const h1 = container.querySelector("h1") as HTMLElement;
    expect(h1.style.fontFamily).toBe("var(--pf-font-heading)");
  });

  it("primary CTA uses var(--pf-color-accent) background", () => {
    const { container } = renderHero({ primaryCtaLabel: "Book Now" });
    const cta = container.querySelector("[data-cta='contact']") as HTMLElement;
    expect(cta).not.toBeNull();
    expect(cta.style.backgroundColor).toBe("var(--pf-color-accent)");
  });

  it("buttons use var(--pf-radius) border-radius", () => {
    const { container } = renderHero({
      primaryCtaLabel: "Book Now",
      primaryCtaAction: "open-contact",
    });
    const cta = container.querySelector("[data-cta='contact']") as HTMLElement;
    expect(cta.style.borderRadius).toBe("var(--pf-radius)");
  });
});

// ---------------------------------------------------------------------------
// CTA behavior
// ---------------------------------------------------------------------------

describe("HeroBlock — CTA behavior", () => {
  it("open-contact CTA has data-cta='contact' attribute", () => {
    const { container } = renderHero({ primaryCtaAction: "open-contact" });
    const cta = container.querySelector("[data-cta='contact']");
    expect(cta).not.toBeNull();
  });

  it("go-to-gallery CTA links to /w/<slug>/gallery with no contact marker", () => {
    const { container } = render(
      <HeroBlock
        {...heroDefaultProps}
        primaryCtaAction="go-to-gallery"
        puck={{ metadata: { workspace: { _id: "ws", name: "Studio", slug: "studio" } } }}
      />
    );
    const galleryLink = Array.from(container.querySelectorAll("a[role='button']")).find(
      (el) => el.getAttribute("href") === "/w/studio/gallery"
    );
    expect(galleryLink).toBeDefined();
    expect((galleryLink as HTMLElement).getAttribute("data-cta")).toBeNull();
  });

  it("secondary CTA renders when secondaryCtaLabel is set", () => {
    renderHero({
      secondaryCtaLabel: "View Portfolio",
      secondaryCtaAction: "go-to-gallery",
    });
    expect(screen.getByText("View Portfolio")).toBeInTheDocument();
  });

  it("secondary CTA does not render when secondaryCtaLabel is empty", () => {
    const { container } = renderHero({
      secondaryCtaLabel: "",
      secondaryCtaAction: undefined,
    });
    const buttons = container.querySelectorAll("a[role='button']");
    expect(buttons).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Height variants
// ---------------------------------------------------------------------------

describe("HeroBlock — height variants", () => {
  it.each([
    ["tall", "80vh"],
    ["medium", "60vh"],
    ["short", "40vh"],
  ] as const)("height='%s' → min-height=%s", (h, expected) => {
    const { container } = renderHero({ height: h });
    const section = container.querySelector("[data-block='hero']") as HTMLElement;
    expect(section.style.minHeight).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Background image
// ---------------------------------------------------------------------------

describe("HeroBlock — background image", () => {
  it("renders an img element when backgroundImagePublicId is set", () => {
    const { container } = renderHero({
      backgroundImagePublicId: "gallurio/ws1/hero",
    });
    const img = container.querySelector("img[aria-hidden='true']");
    expect(img).not.toBeNull();
    expect((img as HTMLImageElement).src).toContain("gallurio/ws1/hero");
  });

  it("renders no img element when no background is set", () => {
    const { container } = renderHero({
      backgroundImagePublicId: "",
      backgroundImageUrl: "",
    });
    expect(container.querySelector("img[aria-hidden='true']")).toBeNull();
  });

  it("overlay opacity is applied as inline rgba style", () => {
    const { container } = renderHero({ backgroundOverlayOpacity: 60 });
    // The overlay div should have rgba with 0.6 alpha
    // Note: browsers/happy-dom normalise rgba(0,0,0,...) → rgba(0, 0, 0, ...)
    const overlayEl = container.querySelector("[aria-hidden='true']:not(img)") as HTMLElement;
    const bg = overlayEl?.style.backgroundColor ?? "";
    expect(bg).toMatch(/rgba\(0,?\s*0,?\s*0,?\s*0\.6\)/);
  });
});

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

describe("HeroBlock — alignment", () => {
  it("center alignment sets textAlign=center on content wrapper", () => {
    const { container } = renderHero({ alignment: "center" });
    const contentDiv = container.querySelector("[data-block='hero'] > div:last-child") as HTMLElement;
    expect(contentDiv?.style.textAlign).toBe("center");
  });

  it("left alignment sets textAlign=left on content wrapper", () => {
    const { container } = renderHero({ alignment: "left" });
    const contentDiv = container.querySelector("[data-block='hero'] > div:last-child") as HTMLElement;
    expect(contentDiv?.style.textAlign).toBe("left");
  });
});

// ---------------------------------------------------------------------------
// Missing optional props
// ---------------------------------------------------------------------------

describe("HeroBlock — missing optional props", () => {
  it("renders without subhead (no crash)", () => {
    expect(() => renderHero({ subhead: undefined })).not.toThrow();
  });

  it("renders without secondary CTA (no crash)", () => {
    expect(() =>
      renderHero({ secondaryCtaLabel: undefined, secondaryCtaAction: undefined })
    ).not.toThrow();
  });

  it("renders with zero overlay opacity without crashing", () => {
    expect(() => renderHero({ backgroundOverlayOpacity: 0 })).not.toThrow();
  });

  it("clamps overlay opacity above 100 to 100", () => {
    const { container } = renderHero({ backgroundOverlayOpacity: 150 });
    const overlayEl = container.querySelector("[aria-hidden='true']:not(img)") as HTMLElement;
    const bg = overlayEl?.style.backgroundColor ?? "";
    expect(bg).toMatch(/rgba\(0,?\s*0,?\s*0,?\s*1\)/);
  });
});
