import { describe, it, expect } from "vitest";
import { applyOptimisticPatch, type InquiryOptimisticPatch } from "./optimistic-patch";

const baseRows = [
  { id: "a", status: "new", name: "Alice" },
  { id: "b", status: "new", name: "Bob" },
  { id: "c", status: "new", name: "Carol" },
];

describe("applyOptimisticPatch", () => {
  it("returns rows unchanged when patches map is empty", () => {
    const result = applyOptimisticPatch(baseRows, {});
    expect(result).toEqual(baseRows);
  });

  it("applies a status patch to the matching row only", () => {
    const patches: Record<string, InquiryOptimisticPatch> = { b: { status: "booked" } };
    const result = applyOptimisticPatch(baseRows, patches);
    expect(result[0].status).toBe("new");
    expect(result[1].status).toBe("booked");
    expect(result[2].status).toBe("new");
  });

  it("merges multiple patch fields onto the row without affecting other rows", () => {
    const patches: Record<string, InquiryOptimisticPatch> = {
      a: { status: "booked", phone: "+63912345678", total: 5000 },
    };
    const result = applyOptimisticPatch(baseRows, patches);
    expect(result[0]).toMatchObject({ id: "a", status: "booked", phone: "+63912345678", total: 5000 });
    expect(result[1]).toEqual(baseRows[1]);
  });

  it("ignores patches for ids not present in rows", () => {
    const patches: Record<string, InquiryOptimisticPatch> = { "z-unknown": { status: "archived" } };
    const result = applyOptimisticPatch(baseRows, patches);
    expect(result).toEqual(baseRows);
  });

  it("does not mutate the original rows array", () => {
    const patches: Record<string, InquiryOptimisticPatch> = { a: { status: "booked" } };
    applyOptimisticPatch(baseRows, patches);
    expect(baseRows[0].status).toBe("new");
  });
});
