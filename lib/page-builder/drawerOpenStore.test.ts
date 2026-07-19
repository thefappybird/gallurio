import { describe, it, expect } from "vitest";
import { getDrawerOpen, setDrawerOpen } from "./drawerOpenStore";

describe("drawerOpenStore", () => {
  it("returns the fallback when the key has no stored value", () => {
    expect(getDrawerOpen("never-set::Layout", true)).toBe(true);
    expect(getDrawerOpen("never-set::Layout", false)).toBe(false);
  });

  it("returns the stored value after set, ignoring the fallback", () => {
    setDrawerOpen("block-1::Layout", true);
    expect(getDrawerOpen("block-1::Layout", false)).toBe(true);
    setDrawerOpen("block-1::Layout", false);
    expect(getDrawerOpen("block-1::Layout", true)).toBe(false);
  });
});
