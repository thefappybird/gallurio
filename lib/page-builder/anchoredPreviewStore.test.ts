import { describe, it, expect, vi } from "vitest";
import { createAnchoredPreviewStore } from "./anchoredPreviewStore";

function fakeAnchor(): HTMLElement {
  return document.createElement("div");
}

describe("createAnchoredPreviewStore", () => {
  it("starts with nothing active", () => {
    const store = createAnchoredPreviewStore();
    expect(store.getActiveKey()).toBeNull();
    expect(store.getAnchor()).toBeNull();
  });

  it("open sets the active key, anchor, and payload; notifies listeners", () => {
    const store = createAnchoredPreviewStore<{ label: string }>();
    const listener = vi.fn();
    store.subscribe(listener);
    const anchor = fakeAnchor();

    store.open("x", anchor, { label: "X" });

    expect(store.getActiveKey()).toBe("x");
    expect(store.getAnchor()).toBe(anchor);
    expect(store.getActivePayload()).toEqual({ label: "X" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("re-opening the SAME key is a no-op (no re-anchor, no notify)", () => {
    const store = createAnchoredPreviewStore<{ label: string }>();
    const listener = vi.fn();
    const anchorA = fakeAnchor();
    const anchorB = fakeAnchor();

    store.open("x", anchorA, { label: "X" });
    store.subscribe(listener);
    store.open("x", anchorB, { label: "X2" });

    expect(store.getAnchor()).toBe(anchorA);
    expect(store.getActivePayload()).toEqual({ label: "X" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("opening a different key swaps the active item", () => {
    const store = createAnchoredPreviewStore<{ label: string }>();
    store.open("x", fakeAnchor(), { label: "X" });

    const anchorY = fakeAnchor();
    store.open("y", anchorY, { label: "Y" });

    expect(store.getActiveKey()).toBe("y");
    expect(store.getAnchor()).toBe(anchorY);
    expect(store.getActivePayload()).toEqual({ label: "Y" });
  });

  it("close clears everything and notifies; is a no-op when already closed", () => {
    const store = createAnchoredPreviewStore<{ label: string }>();
    store.open("x", fakeAnchor(), { label: "X" });
    const listener = vi.fn();
    store.subscribe(listener);

    store.close();
    expect(store.getActiveKey()).toBeNull();
    expect(store.getAnchor()).toBeNull();
    expect(store.getActivePayload()).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);

    store.close();
    expect(listener).toHaveBeenCalledTimes(1); // still 1 — no-op
  });

  it("unsubscribe stops further notifications", () => {
    const store = createAnchoredPreviewStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.open("x", fakeAnchor());

    expect(listener).not.toHaveBeenCalled();
  });

  it("reset clears state and listeners (test-only)", () => {
    const store = createAnchoredPreviewStore();
    store.open("x", fakeAnchor());
    const listener = vi.fn();
    store.subscribe(listener);

    store.reset();

    expect(store.getActiveKey()).toBeNull();
    expect(store.getAnchor()).toBeNull();
    store.open("y", fakeAnchor());
    expect(listener).not.toHaveBeenCalled(); // reset also cleared listeners
  });
});
