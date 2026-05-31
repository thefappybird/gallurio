import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CTABannerBlock, ctaBannerDefaultProps } from "./CTABannerBlock";
import type { CTABannerProps } from "./CTABannerBlock";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string) =>
      `https://res.cloudinary.com/test/image/upload/c_fill,w_1600,h_1600,q_auto,f_auto/${publicId}`
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBanner(overrides: Partial<CTABannerProps> = {}) {
  return render(<CTABannerBlock {...ctaBannerDefaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("CTABannerBlock — renders with default props", () => {
  it("renders without crashing", () => {
    const { container } = renderBanner();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders data-block=cta-banner marker", () => {
    const { container } = renderBanner();
    expect(container.querySelector("[data-block='cta-banner']")).toBeInTheDocument();
  });

  it("renders the headline", () => {
    renderBanner({ headline: "Book Your Session" });
    expect(screen.getByText("Book Your Session")).toBeInTheDocument();
  });

  it("renders the CTA button label", () => {
    renderBanner({ ctaLabel: "Contact Me" });
    expect(screen.getByText("Contact Me")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Brand-kit CSS variables
// ---------------------------------------------------------------------------

describe("CTABannerBlock — brand-kit CSS variables", () => {
  it("accent background uses var(--pf-color-accent)", () => {
    const { container } = renderBanner({ background: "accent" });
    const section = container.querySelector("[data-block='cta-banner']") as HTMLElement;
    expect(section.style.backgroundColor).toBe("var(--pf-color-accent)");
  });

  it("surface background uses var(--pf-color-secondary)", () => {
    const { container } = renderBanner({ background: "surface" });
    const section = container.querySelector("[data-block='cta-banner']") as HTMLElement;
    expect(section.style.backgroundColor).toBe("var(--pf-color-secondary)");
  });

  it("heading uses var(--pf-font-heading)", () => {
    const { container } = renderBanner({ headline: "CTA Heading" });
    const h2 = container.querySelector("h2") as HTMLElement;
    expect(h2.style.fontFamily).toBe("var(--pf-font-heading)");
  });

  it("CTA button uses var(--pf-radius)", () => {
    const { container } = renderBanner({ ctaLabel: "Go" });
    const btn = container.querySelector("a[role='button']") as HTMLElement;
    expect(btn.style.borderRadius).toBe("var(--pf-radius)");
  });
});

// ---------------------------------------------------------------------------
// CTA behavior
// ---------------------------------------------------------------------------

describe("CTABannerBlock — CTA behavior", () => {
  it("open-contact CTA has data-cta='contact'", () => {
    const { container } = renderBanner({ ctaAction: "open-contact" });
    expect(container.querySelector("[data-cta='contact']")).toBeInTheDocument();
  });

  it("go-to-gallery CTA links to /w/<slug>/gallery with no contact marker", () => {
    const { container } = render(
      <CTABannerBlock
        {...ctaBannerDefaultProps}
        ctaAction="go-to-gallery"
        puck={{ metadata: { workspace: { _id: "ws", name: "Studio", slug: "studio" } } }}
      />
    );
    const link = container.querySelector("a[role='button']") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/w/studio/gallery");
    expect(link.getAttribute("data-cta")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Background variants
// ---------------------------------------------------------------------------

describe("CTABannerBlock — background variants", () => {
  it("renders background image when background=image and publicId set", () => {
    const { container } = renderBanner({
      background: "image",
      backgroundImagePublicId: "gallurio/ws1/cta-bg",
    });
    const img = container.querySelector("img[aria-hidden='true']");
    expect(img).not.toBeNull();
    expect((img as HTMLImageElement).src).toContain("gallurio/ws1/cta-bg");
  });

  it("does not render img when background=accent", () => {
    const { container } = renderBanner({ background: "accent" });
    expect(container.querySelector("img[aria-hidden='true']")).toBeNull();
  });

  it("does not render img when background=surface", () => {
    const { container } = renderBanner({ background: "surface" });
    expect(container.querySelector("img[aria-hidden='true']")).toBeNull();
  });

  it("renders scrim overlay when background image is set", () => {
    const { container } = renderBanner({
      background: "image",
      backgroundImageUrl: "https://example.com/bg.jpg",
    });
    // Two aria-hidden elements: img + scrim div
    const ariaHiddenEls = container.querySelectorAll("[aria-hidden='true']");
    expect(ariaHiddenEls.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Subhead
// ---------------------------------------------------------------------------

describe("CTABannerBlock — subhead", () => {
  it("renders subhead when provided", () => {
    renderBanner({ subhead: "Let's create together." });
    expect(screen.getByText("Let's create together.")).toBeInTheDocument();
  });

  it("does not render subhead element when omitted", () => {
    const { container } = renderBanner({ subhead: undefined });
    // Only the h2 and button should be inside the content div
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Missing optional props
// ---------------------------------------------------------------------------

describe("CTABannerBlock — missing optional props", () => {
  it("renders without subhead (no crash)", () => {
    expect(() => renderBanner({ subhead: undefined })).not.toThrow();
  });

  it("renders without backgroundImagePublicId (no crash)", () => {
    expect(() =>
      renderBanner({ background: "image", backgroundImagePublicId: "" })
    ).not.toThrow();
  });

  it("renders an open-contact CTA (no crash)", () => {
    expect(() => renderBanner({ ctaAction: "open-contact" })).not.toThrow();
  });
});
