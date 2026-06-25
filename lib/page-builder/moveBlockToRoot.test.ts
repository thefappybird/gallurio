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
});
