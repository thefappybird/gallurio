import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  openPresetPreview,
  closePresetPreview,
  getActivePresetPreview,
  getActivePresetAnchor,
  subscribePresetPreview,
  __resetPresetPreview,
} from "./presetPreviewStore";

/** Stand-in for a drawer row element. */
function row(top = 100): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ top, left: 0, right: 240, bottom: top + 32, width: 240, height: 32 }) as DOMRect;
  return el;
}

beforeEach(() => __resetPresetPreview());

describe("presetPreviewStore", () => {
  it("opening a preview makes it the active one", () => {
    openPresetPreview("HeroPreset", row());
    expect(getActivePresetPreview()).toBe("HeroPreset");
  });

  // Only one preview may be open. Puck mounts every drawer row TWICE (the
  // draggable plus a Drawer-draggableBg ghost); per-row state gave each preset
  // two popovers whose pointer handlers fought each other, which is the flicker
  // this store replaces. A single keyed value makes both copies agree.
  it("opening another preview replaces the current one rather than stacking", () => {
    openPresetPreview("HeroPreset", row());
    openPresetPreview("FooterSignaturePreset", row(200));
    expect(getActivePresetPreview()).toBe("FooterSignaturePreset");
  });

  // The panel is rendered once, outside the rows (two mounts per row would
  // otherwise each render their own copy), so the store must carry the anchor
  // the single panel positions against.
  it("carries the anchor element the preview should sit beside", () => {
    const el = row(140);
    openPresetPreview("HeroPreset", el);
    expect(getActivePresetAnchor()).toBe(el);
  });

  it("closing clears the anchor along with the name", () => {
    openPresetPreview("HeroPreset", row());
    closePresetPreview();
    expect(getActivePresetAnchor()).toBeNull();
  });

  it("closing clears the active preview", () => {
    openPresetPreview("HeroPreset", row());
    closePresetPreview();
    expect(getActivePresetPreview()).toBeNull();
  });

  it("notifies subscribers on open and on close", () => {
    const listener = vi.fn();
    subscribePresetPreview(listener);

    openPresetPreview("HeroPreset", row());
    closePresetPreview();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  // Re-opening the SAME row that is already showing must not churn React — the
  // pointer sitting on one row fires pointerenter repeatedly.
  it("does not notify when the same preview and row are re-opened", () => {
    const el = row();
    openPresetPreview("HeroPreset", el);
    const listener = vi.fn();
    subscribePresetPreview(listener);

    openPresetPreview("HeroPreset", el);

    expect(listener).not.toHaveBeenCalled();
  });

  // ...but the same preset anchored to the OTHER mount (Puck renders each row
  // twice) must move the panel rather than leave it beside a stale element.
  it("notifies when the same preset is re-anchored to a different row", () => {
    openPresetPreview("HeroPreset", row(100));
    const listener = vi.fn();
    subscribePresetPreview(listener);

    openPresetPreview("HeroPreset", row(160));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify when closing with nothing open", () => {
    const listener = vi.fn();
    subscribePresetPreview(listener);

    closePresetPreview();

    expect(listener).not.toHaveBeenCalled();
  });

  it("unsubscribing stops delivery", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePresetPreview(listener);
    unsubscribe();

    openPresetPreview("HeroPreset", row());

    expect(listener).not.toHaveBeenCalled();
  });
});
