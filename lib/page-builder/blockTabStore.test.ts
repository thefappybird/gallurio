import { describe, it, expect, beforeEach } from "vitest";
import { getBlockTab, setBlockTab } from "./blockTabStore";

// Re-import as a fresh module for each test to avoid cross-test pollution.
// The store is module-level, so we clear by calling setBlockTab back to defaults.

describe("blockTabStore", () => {
  beforeEach(() => {
    // Reset any entries set during previous tests by overwriting with "content".
    setBlockTab("block-a", "content");
    setBlockTab("block-b", "content");
  });

  it("returns 'content' for an unknown block id", () => {
    expect(getBlockTab("unknown-block-xyz")).toBe("content");
  });

  it("stores and retrieves a tab for a block id", () => {
    setBlockTab("block-a", "layout");
    expect(getBlockTab("block-a")).toBe("layout");
  });

  it("a different block id returns its own value independently", () => {
    setBlockTab("block-a", "design");
    setBlockTab("block-b", "layout");
    expect(getBlockTab("block-a")).toBe("design");
    expect(getBlockTab("block-b")).toBe("layout");
  });

  it("updating a block id overwrites the previous value", () => {
    setBlockTab("block-a", "layout");
    setBlockTab("block-a", "design");
    expect(getBlockTab("block-a")).toBe("design");
  });

  it("a block id with no entry defaults to 'content' even after others are set", () => {
    setBlockTab("block-a", "layout");
    expect(getBlockTab("completely-new-id")).toBe("content");
  });
});
