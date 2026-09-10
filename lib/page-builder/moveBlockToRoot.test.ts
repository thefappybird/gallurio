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

  it("moves a block one level up: destination is the parent's own zone at parent's index + 1", () => {
    // block sits in "columnsB:cell" (its container is Columns B); Columns B
    // itself lives at index 0 of Container A's slot.
    const result = selectedBlockActions(
      { index: 0, zone: "columnsB:cell" },
      5,
      (parentBlockId) => {
        expect(parentBlockId).toBe("columnsB");
        return { index: 0, zone: "containerA:content" };
      },
    );
    expect(result?.moveOut).toEqual({
      type: "move",
      sourceIndex: 0,
      sourceZone: "columnsB:cell",
      destinationZone: "containerA:content",
      destinationIndex: 1,
    });
  });

  it("walks a block out one level at a time via repeated calls", () => {
    // Step 1: cell -> Container A's slot (after Columns B).
    const step1 = selectedBlockActions(
      { index: 0, zone: "columnsB:cell" },
      5,
      () => ({ index: 0, zone: "containerA:content" }),
    );
    expect(step1?.moveOut).toEqual({
      type: "move",
      sourceIndex: 0,
      sourceZone: "columnsB:cell",
      destinationZone: "containerA:content",
      destinationIndex: 1,
    });

    // Step 2: now at containerA:content index 1 -> Container A's own parent
    // is root, at root index 0 -> destination root index 1.
    const step2 = selectedBlockActions(
      { index: 1, zone: "containerA:content" },
      5,
      () => ({ index: 0, zone: ROOT_ZONE }),
    );
    expect(step2?.moveOut).toEqual({
      type: "move",
      sourceIndex: 1,
      sourceZone: "containerA:content",
      destinationZone: ROOT_ZONE,
      destinationIndex: 1,
    });

    // Step 3: now at root -> moveOut is null, walk is complete.
    const step3 = selectedBlockActions({ index: 1 }, 5);
    expect(step3?.moveOut).toBeNull();
  });

  it("resolves destination to ROOT_ZONE at parentIndex + 1 when the parent is itself a root-level block", () => {
    const result = selectedBlockActions(
      { index: 0, zone: "hero:content" },
      5,
      () => ({ index: 2, zone: ROOT_ZONE }),
    );
    expect(result?.moveOut).toEqual({
      type: "move",
      sourceIndex: 0,
      sourceZone: "hero:content",
      destinationZone: ROOT_ZONE,
      destinationIndex: 3,
    });
  });

  it("resolves destinationIndex to rootContentLength (old append-at-end behaviour) when the parent is the LAST root block", () => {
    const result = selectedBlockActions(
      { index: 0, zone: "hero:content" },
      3, // rootContentLength
      () => ({ index: 2, zone: ROOT_ZONE }), // parent is root's last block (index 2 of 3)
    );
    expect(result?.moveOut).toEqual({
      type: "move",
      sourceIndex: 0,
      sourceZone: "hero:content",
      destinationZone: ROOT_ZONE,
      destinationIndex: 3,
    });
  });

  it("falls back to appending at the end of root when the zone id is malformed (no colon)", () => {
    const result = selectedBlockActions({ index: 0, zone: "malformed-no-colon" }, 4);
    expect(result?.moveOut).toEqual({
      type: "move",
      sourceIndex: 0,
      sourceZone: "malformed-no-colon",
      destinationZone: ROOT_ZONE,
      destinationIndex: 4,
    });
  });

  it("falls back to appending at the end of root when the parent lookup returns null (parent not found)", () => {
    const result = selectedBlockActions(
      { index: 0, zone: "hero:content" },
      4,
      () => null,
    );
    expect(result?.moveOut).toEqual({
      type: "move",
      sourceIndex: 0,
      sourceZone: "hero:content",
      destinationZone: ROOT_ZONE,
      destinationIndex: 4,
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
