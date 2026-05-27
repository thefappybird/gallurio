import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ServicesListBlock, servicesListDefaultProps } from "./ServicesListBlock";
import type { ServicesListProps } from "./ServicesListBlock";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderServices(overrides: Partial<ServicesListProps> = {}) {
  return render(<ServicesListBlock {...servicesListDefaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("ServicesListBlock — renders with default props", () => {
  it("renders without crashing", () => {
    const { container } = renderServices();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders data-block=services-list marker", () => {
    const { container } = renderServices();
    expect(container.querySelector("[data-block='services-list']")).toBeInTheDocument();
  });

  it("renders the section heading", () => {
    renderServices({ heading: "What I Offer" });
    expect(screen.getByText("What I Offer")).toBeInTheDocument();
  });

  it("renders all items", () => {
    renderServices({
      items: [
        { title: "Wedding", description: "Full day coverage." },
        { title: "Portrait", description: "Studio sessions." },
      ],
    });
    expect(screen.getByText("Wedding")).toBeInTheDocument();
    expect(screen.getByText("Portrait")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Brand-kit CSS variables
// ---------------------------------------------------------------------------

describe("ServicesListBlock — brand-kit CSS variables", () => {
  it("section uses var(--pf-color-bg)", () => {
    const { container } = renderServices();
    const section = container.querySelector("[data-block='services-list']") as HTMLElement;
    expect(section.style.backgroundColor).toBe("var(--pf-color-bg)");
  });

  it("section uses var(--pf-color-fg)", () => {
    const { container } = renderServices();
    const section = container.querySelector("[data-block='services-list']") as HTMLElement;
    expect(section.style.color).toBe("var(--pf-color-fg)");
  });

  it("heading uses var(--pf-font-heading)", () => {
    const { container } = renderServices({ heading: "Services" });
    const h2 = container.querySelector("h2") as HTMLElement;
    expect(h2.style.fontFamily).toBe("var(--pf-font-heading)");
  });

  it("price uses var(--pf-color-accent)", () => {
    const { container } = renderServices({
      items: [{ title: "Wedding", priceFrom: "₱30,000" }],
    });
    const priceEl = container.querySelector("[data-testid='service-card'] p:last-of-type") as HTMLElement;
    expect(priceEl.style.color).toBe("var(--pf-color-accent)");
  });

  it("service card uses var(--pf-radius)", () => {
    const { container } = renderServices({
      items: [{ title: "Test Service" }],
    });
    const card = container.querySelector("[data-testid='service-card']") as HTMLElement;
    expect(card.style.borderRadius).toBe("var(--pf-radius)");
  });
});

// ---------------------------------------------------------------------------
// Max items enforcement
// ---------------------------------------------------------------------------

describe("ServicesListBlock — max items", () => {
  it("caps items at 8", () => {
    const tooMany = Array.from({ length: 12 }, (_, i) => ({
      title: `Service ${i + 1}`,
    }));
    const { container } = renderServices({ items: tooMany });
    const cards = container.querySelectorAll("[data-testid='service-card']");
    expect(cards.length).toBe(8);
  });

  it("renders exactly 8 when given exactly 8", () => {
    const exactly8 = Array.from({ length: 8 }, (_, i) => ({
      title: `Service ${i + 1}`,
    }));
    const { container } = renderServices({ items: exactly8 });
    const cards = container.querySelectorAll("[data-testid='service-card']");
    expect(cards.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Service card fields
// ---------------------------------------------------------------------------

describe("ServicesListBlock — service card fields", () => {
  it("renders icon when provided", () => {
    renderServices({ items: [{ title: "Photo", icon: "📷" }] });
    expect(screen.getByText("📷")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    renderServices({
      items: [{ title: "Photo", description: "Studio sessions" }],
    });
    expect(screen.getByText("Studio sessions")).toBeInTheDocument();
  });

  it("renders priceFrom with 'Starting from' prefix", () => {
    renderServices({ items: [{ title: "Photo", priceFrom: "₱5,000" }] });
    expect(screen.getByText("Starting from ₱5,000")).toBeInTheDocument();
  });

  it("does not render icon span when icon is falsy", () => {
    const { container } = renderServices({
      items: [{ title: "No Icon", icon: "" }],
    });
    const iconSpans = container.querySelectorAll("[aria-hidden='true']");
    expect(iconSpans.length).toBe(0);
  });

  it("does not render description when omitted", () => {
    renderServices({ items: [{ title: "Minimal" }] });
    // Should not throw; description paragraph should not exist
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Missing optional props
// ---------------------------------------------------------------------------

describe("ServicesListBlock — missing optional props", () => {
  it("renders with empty items array (no crash)", () => {
    expect(() => renderServices({ items: [] })).not.toThrow();
  });

  it("renders with empty heading (no crash)", () => {
    expect(() => renderServices({ heading: "" })).not.toThrow();
  });
});
