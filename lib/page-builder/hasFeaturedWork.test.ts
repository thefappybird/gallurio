import { describe, it, expect, vi } from "vitest";
import { hasFeaturedWorkInZones, resolveCollectionsPopupAction, computeCollectionsPopupAction, applyCollectionsPopupBranch } from "./hasFeaturedWork";

describe("hasFeaturedWorkInZones", () => {
  it("returns false when no zones contain a FeaturedWork block", () => {
    const zones = {
      home: { content: [{ type: "HeroBlock", props: {}, readOnly: false }], root: {} },
      gallery: { content: [], root: {} },
    };
    expect(hasFeaturedWorkInZones(zones)).toBe(false);
  });

  it("returns true when gallery zone contains a FeaturedWork block", () => {
    const zones = {
      home: { content: [], root: {} },
      gallery: { content: [{ type: "FeaturedWork", props: {}, readOnly: false }], root: {} },
    };
    expect(hasFeaturedWorkInZones(zones)).toBe(true);
  });

  it("returns true when a FeaturedWork block is nested inside a container slot (preset case)", () => {
    // The "Featured Work" preset inserts a Container whose `content` slot holds
    // the FeaturedWork child — a top-level-only scan would miss it.
    const zones = {
      home: {
        content: [
          {
            type: "Container",
            props: {
              content: [
                { type: "Heading", props: {} },
                { type: "FeaturedWork", props: {} },
              ],
            },
            readOnly: false,
          },
        ],
        root: {},
      },
      gallery: { content: [], root: {} },
    };
    expect(hasFeaturedWorkInZones(zones)).toBe(true);
  });
});

it("resolveCollectionsPopupAction returns 'warn' when no FeaturedWork is present", () => {
  expect(resolveCollectionsPopupAction(false)).toBe("warn");
});

it("resolveCollectionsPopupAction returns 'open' when FeaturedWork is present", () => {
  expect(resolveCollectionsPopupAction(true)).toBe("open");
});

it("computeCollectionsPopupAction returns 'warn' when zones have no FeaturedWork block", () => {
  const zones = { home: { content: [], root: {} }, gallery: { content: [], root: {} } };
  expect(computeCollectionsPopupAction(zones)).toBe("warn");
});

it("applyCollectionsPopupBranch calls warn callback when action is 'warn'", () => {
  const open = vi.fn();
  const warn = vi.fn();
  applyCollectionsPopupBranch("warn", { open, warn });
  expect(warn).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
});

it("applyCollectionsPopupBranch calls open callback when action is 'open'", () => {
  const open = vi.fn();
  const warn = vi.fn();
  applyCollectionsPopupBranch("open", { open, warn });
  expect(open).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
});

it("open-collections-popup path: calls warn (not open) when zones have no FeaturedWork", () => {
  const openCollections = vi.fn();
  const showWarning = vi.fn();
  const zones = { home: { content: [], root: {} }, gallery: { content: [], root: {} } };
  applyCollectionsPopupBranch(computeCollectionsPopupAction(zones), {
    open: openCollections,
    warn: showWarning,
  });
  expect(showWarning).toHaveBeenCalledTimes(1);
  expect(openCollections).not.toHaveBeenCalled();
});
