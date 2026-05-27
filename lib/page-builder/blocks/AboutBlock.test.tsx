import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AboutBlock, aboutDefaultProps } from "./AboutBlock";
import type { AboutBlockProps } from "./AboutBlock";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string) =>
      `https://res.cloudinary.com/test/image/upload/c_fill,w_800,h_900,q_auto,f_auto/${publicId}`
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderAbout(overrides: Partial<AboutBlockProps> = {}) {
  return render(<AboutBlock {...aboutDefaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("AboutBlock — renders with default props", () => {
  it("renders without crashing", () => {
    const { container } = renderAbout();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders data-block=about marker", () => {
    const { container } = renderAbout();
    expect(container.querySelector("[data-block='about']")).toBeInTheDocument();
  });

  it("renders the heading", () => {
    renderAbout({ heading: "My Story" });
    expect(screen.getByText("My Story")).toBeInTheDocument();
  });

  it("renders the body text", () => {
    renderAbout({ body: "Passionate photographer." });
    expect(screen.getByText("Passionate photographer.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Brand-kit CSS variables
// ---------------------------------------------------------------------------

describe("AboutBlock — brand-kit CSS variables", () => {
  it("section wrapper uses var(--pf-color-bg)", () => {
    const { container } = renderAbout();
    const section = container.querySelector("[data-block='about']") as HTMLElement;
    expect(section.style.backgroundColor).toBe("var(--pf-color-bg)");
  });

  it("section wrapper uses var(--pf-color-fg)", () => {
    const { container } = renderAbout();
    const section = container.querySelector("[data-block='about']") as HTMLElement;
    expect(section.style.color).toBe("var(--pf-color-fg)");
  });

  it("heading uses var(--pf-font-heading)", () => {
    const { container } = renderAbout({ heading: "About Me" });
    const h2 = container.querySelector("h2") as HTMLElement;
    expect(h2.style.fontFamily).toBe("var(--pf-font-heading)");
  });

  it("credential accent border uses var(--pf-color-accent)", () => {
    const { container } = renderAbout({
      credentials: [{ label: "Years", value: "10" }],
    });
    const credDiv = container.querySelector("[data-testid='credentials-list'] > div") as HTMLElement;
    expect(credDiv.style.borderTop).toContain("var(--pf-color-accent)");
  });
});

// ---------------------------------------------------------------------------
// Body text line-break preservation
// ---------------------------------------------------------------------------

describe("AboutBlock — body text", () => {
  it("uses white-space: pre-line for body", () => {
    const { container } = renderAbout({ body: "Line one\nLine two" });
    const p = container.querySelector("p") as HTMLElement;
    expect(p.style.whiteSpace).toBe("pre-line");
  });
});

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

describe("AboutBlock — image", () => {
  it("renders img when imagePublicId is set", () => {
    const { container } = renderAbout({
      imagePublicId: "gallurio/ws1/about",
    });
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.src).toContain("gallurio/ws1/about");
  });

  it("renders img when imageUrl is set (no publicId)", () => {
    const { container } = renderAbout({
      imagePublicId: "",
      imageUrl: "https://example.com/photo.jpg",
    });
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.src).toBe("https://example.com/photo.jpg");
  });

  it("does not render img when no image is provided", () => {
    const { container } = renderAbout({
      imagePublicId: "",
      imageUrl: "",
    });
    expect(container.querySelector("img")).toBeNull();
  });

  it("imagePosition=left: image column has order 1", () => {
    const { container } = renderAbout({
      imagePublicId: "test/img",
      imagePosition: "left",
    });
    const gridChildren = container.querySelectorAll(".pf-about-grid > *");
    // image column is the second child in DOM but should have order:1 when left
    const imageDiv = gridChildren[1] as HTMLElement;
    expect(imageDiv.style.order).toBe("1");
  });

  it("imagePosition=right: image column has order 2", () => {
    const { container } = renderAbout({
      imagePublicId: "test/img",
      imagePosition: "right",
    });
    const gridChildren = container.querySelectorAll(".pf-about-grid > *");
    const imageDiv = gridChildren[1] as HTMLElement;
    expect(imageDiv.style.order).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

describe("AboutBlock — credentials", () => {
  it("renders credentials list", () => {
    renderAbout({
      credentials: [
        { label: "Experience", value: "10 years" },
        { label: "Style", value: "Fine art" },
      ],
    });
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText("10 years")).toBeInTheDocument();
    expect(screen.getByText("Style")).toBeInTheDocument();
    expect(screen.getByText("Fine art")).toBeInTheDocument();
  });

  it("caps credentials at 6", () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => ({
      label: `Label${i}`,
      value: `Value${i}`,
    }));
    const { container } = renderAbout({ credentials: tooMany });
    const items = container.querySelectorAll("[data-testid='credentials-list'] > div");
    expect(items.length).toBe(6);
  });

  it("renders no credentials list when credentials is empty", () => {
    const { container } = renderAbout({ credentials: [] });
    expect(container.querySelector("[data-testid='credentials-list']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Missing optional props
// ---------------------------------------------------------------------------

describe("AboutBlock — missing optional props", () => {
  it("renders without image (no crash)", () => {
    expect(() => renderAbout({ imagePublicId: undefined, imageUrl: undefined })).not.toThrow();
  });

  it("renders without credentials (no crash)", () => {
    expect(() => renderAbout({ credentials: undefined })).not.toThrow();
  });
});
