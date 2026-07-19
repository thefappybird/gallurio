import { describe, it, expect } from "vitest";
import { resolveDiscardTarget } from "./draftDiscard";

describe("resolveDiscardTarget", () => {
  it("re-fetches the current draft when it is already saved (has an id)", () => {
    expect(
      resolveDiscardTarget("draft-1", [{ id: "draft-1" }, { id: "draft-2" }]),
    ).toEqual({ type: "refetch", id: "draft-1" });
  });

  it("opens the next available draft when discarding a new, never-saved draft", () => {
    expect(resolveDiscardTarget(null, [{ id: "draft-2" }, { id: "draft-3" }])).toEqual({
      type: "open",
      id: "draft-2",
    });
  });

  it("falls back to an empty scratch canvas when no other draft exists", () => {
    expect(resolveDiscardTarget(null, [])).toEqual({ type: "scratch" });
  });
});
