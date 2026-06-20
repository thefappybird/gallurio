import { describe, it, expect } from "vitest";
import {
  PF_CONTAINER_NAME,
  PF_BP_TABLET_MAX,
  PF_BP_COMPACT,
  PF_BP_NARROW,
  PF_PAGE_CONTAINER,
  PF_PAGE_CONTAINER_CSS,
  PF_RESPONSIVE_CSS,
  padVar,
  gridColsVar,
  masonryColsVar,
} from "./responsive";

describe("responsive helpers", () => {
  it("uses page-width breakpoints aligned to the device toggle", () => {
    expect(PF_BP_TABLET_MAX).toBe(900);
    expect(PF_BP_COMPACT).toBe(600);
    expect(PF_BP_NARROW).toBe(400);
  });

  it("exposes page-container inline props with inline-size containment", () => {
    expect(PF_PAGE_CONTAINER.containerType).toBe("inline-size");
    expect(PF_PAGE_CONTAINER.containerName).toBe(PF_CONTAINER_NAME);
    // `size` would collapse height; we must use `inline-size`.
    expect(PF_PAGE_CONTAINER.containerType).not.toBe("size");
  });

  it("wraps defaults in the matching custom property", () => {
    expect(padVar("4rem 1.5rem")).toBe("var(--pf-pad, 4rem 1.5rem)");
    expect(gridColsVar("repeat(3, 1fr)")).toBe("var(--pf-grid-cols, repeat(3, 1fr))");
    expect(masonryColsVar(3)).toBe("var(--pf-masonry-cols, 3)");
  });

  it("emits an equivalent CSS string for injected style seams", () => {
    expect(PF_PAGE_CONTAINER_CSS).toContain("container-type: inline-size");
    expect(PF_PAGE_CONTAINER_CSS).toContain(`container-name: ${PF_CONTAINER_NAME}`);
  });

  it("scopes every rule to the pfpage container, never @media", () => {
    const containerRules = PF_RESPONSIVE_CSS.match(/@container/g) ?? [];
    expect(containerRules.length).toBe(3);
    expect(PF_RESPONSIVE_CSS).not.toContain("@media");
    for (const bp of [PF_BP_TABLET_MAX, PF_BP_COMPACT, PF_BP_NARROW]) {
      expect(PF_RESPONSIVE_CSS).toContain(`@container ${PF_CONTAINER_NAME} (max-width: ${bp}px)`);
    }
  });

  it("orders breakpoints widest -> narrowest so the cascade steps down", () => {
    const tablet = PF_RESPONSIVE_CSS.indexOf(`${PF_BP_TABLET_MAX}px`);
    const compact = PF_RESPONSIVE_CSS.indexOf(`${PF_BP_COMPACT}px`);
    const narrow = PF_RESPONSIVE_CSS.indexOf(`${PF_BP_NARROW}px`);
    expect(tablet).toBeLessThan(compact);
    expect(compact).toBeLessThan(narrow);
  });

  it("reassigns the shared custom properties blocks reference inline", () => {
    expect(PF_RESPONSIVE_CSS).toContain("--pf-pad:");
    expect(PF_RESPONSIVE_CSS).toContain("--pf-grid-cols:");
    expect(PF_RESPONSIVE_CSS).toContain("--pf-masonry-cols:");
    expect(PF_RESPONSIVE_CSS).toContain("--pf-overlay-px:");
    // Narrowest tier collapses grids/masonry to a single column.
    expect(PF_RESPONSIVE_CSS).toContain("--pf-grid-cols: 1fr");
    expect(PF_RESPONSIVE_CSS).toContain("--pf-masonry-cols: 1");
  });
});
