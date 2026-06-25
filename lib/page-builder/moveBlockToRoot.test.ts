import { describe, it, expect } from "vitest";
import { moveBlockToRootAction, selectedBlockActions, ROOT_ZONE } from "./moveBlockToRoot";

describe("moveBlockToRootAction", () => {
  it("returns a move action for a nested block", () => {
    const indexes = {
      nodes: {
        "block-1": { zone: "hero:content" },
      },
      zones: {
        "hero:content": { contentIds: ["block-1"] },
        [ROOT_ZONE]: { contentIds: ["hero"] },
      },
    };

    const result = moveBlockToRootAction(indexes, "block-1");

    expect(result).toEqual({
      type: "move",
      sourceZone: "hero:content",
      sourceIndex: 0,
      destinationZone: ROOT_ZONE,
      destinationIndex: 1,
    });
  });

  it("returns null when the item is already at the root zone", () => {
    const indexes = {
      nodes: {
        hero: { zone: ROOT_ZONE },
      },
      zones: {
        [ROOT_ZONE]: { contentIds: ["hero"] },
      },
    };

    expect(moveBlockToRootAction(indexes, "hero")).toBeNull();
  });

  it("returns null when the item id is not in nodes", () => {
    const indexes = {
      nodes: {},
      zones: {
        [ROOT_ZONE]: { contentIds: [] },
      },
    };

    expect(moveBlockToRootAction(indexes, "nonexistent")).toBeNull();
  });

  it("uses destinationIndex 0 when root zone has no contentIds entry", () => {
    const indexes = {
      nodes: {
        "block-1": { zone: "hero:content" },
      },
      zones: {
        "hero:content": { contentIds: ["block-1"] },
        // root zone absent
      },
    };

    const result = moveBlockToRootAction(indexes, "block-1");

    expect(result).toEqual({
      type: "move",
      sourceZone: "hero:content",
      sourceIndex: 0,
      destinationZone: ROOT_ZONE,
      destinationIndex: 0,
    });
  });
});

describe("selectedBlockActions", () => {
  it("returns null when itemSelector is null", () => {
    expect(selectedBlockActions(null, 3)).toBeNull();
  });

  it("sets moveOut to null for a root block (no zone)", () => {
    const result = selectedBlockActions({ index: 1 }, 3);
    expect(result?.moveOut).toBeNull();
  });

  it("provides moveOut action for nested block pointing to root at rootContentLength", () => {
    const result = selectedBlockActions({ index: 0, zone: "hero:content" }, 2);
    expect(result?.moveOut).toEqual({
      type: "move",
      sourceIndex: 0,
      sourceZone: "hero:content",
      destinationZone: ROOT_ZONE,
      destinationIndex: 2,
    });
  });

  it("sets moveUp to null when block is at index 0", () => {
    const result = selectedBlockActions({ index: 0 }, 1);
    expect(result?.moveUp).toBeNull();
  });

  it("provides moveUp action moving to sourceIndex - 1 within same zone", () => {
    const result = selectedBlockActions({ index: 2 }, 3);
    expect(result?.moveUp).toEqual({
      type: "move",
      sourceIndex: 2,
      sourceZone: ROOT_ZONE,
      destinationZone: ROOT_ZONE,
      destinationIndex: 1,
    });
  });

  it("provides moveDown action moving to sourceIndex + 1 within same zone", () => {
    const result = selectedBlockActions({ index: 1, zone: "hero:content" }, 2);
    expect(result?.moveDown).toEqual({
      type: "move",
      sourceIndex: 1,
      sourceZone: "hero:content",
      destinationZone: "hero:content",
      destinationIndex: 2,
    });
  });

  it("provides duplicate action with correct sourceIndex and zone", () => {
    const result = selectedBlockActions({ index: 3, zone: "gallery:grid" }, 1);
    expect(result?.duplicate).toEqual({
      type: "duplicate",
      sourceIndex: 3,
      sourceZone: "gallery:grid",
    });
  });

  it("provides remove action with correct index and zone defaulting to ROOT_ZONE", () => {
    const result = selectedBlockActions({ index: 2 }, 5);
    expect(result?.remove).toEqual({
      type: "remove",
      index: 2,
      zone: ROOT_ZONE,
    });
  });
});
