import { describe, it, expect } from "vitest";
import { applyOptimisticPatch, type InquiryOptimisticPatch } from "./optimistic-patch";

const baseRows = [
  { id: "a", status: "inquiry", name: "Alice" },
  { id: "b", status: "inquiry", name: "Bob" },
  { id: "c", status: "inquiry", name: "Carol" },
];

describe("applyOptimisticPatch", () => {
  it("returns rows unchanged when patches map is empty", () => {
    const result = applyOptimisticPatch(baseRows, {});
    expect(result).toEqual(baseRows);
  });

  it("applies a status patch to the matching row only", () => {
    const patches: Record<string, InquiryOptimisticPatch> = { b: { status: "booked" } };
    const result = applyOptimisticPatch(baseRows, patches);
    expect(result[0].status).toBe("inquiry");
    expect(result[1].status).toBe("booked");
    expect(result[2].status).toBe("inquiry");
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
    expect(baseRows[0].status).toBe("inquiry");
  });
});

describe("prune-on-match reconciliation", () => {
  // Helper that mirrors the useEffect logic in InquiriesPageClient:
  // iterate patch entries, drop any whose fields the server row now reflects.
  function reconcile(
    prev: Record<string, InquiryOptimisticPatch>,
    rows: { id: string; [k: string]: unknown }[]
  ): Record<string, InquiryOptimisticPatch> {
    const keys = Object.keys(prev);
    if (keys.length === 0) return prev;

    const rowMap = new Map(rows.map((r) => [r.id, r]));
    let changed = false;
    const next: Record<string, InquiryOptimisticPatch> = {};

    for (const id of keys) {
      const patch = prev[id];
      const serverRow = rowMap.get(id) as Record<string, unknown> | undefined;

      if (!serverRow) {
        next[id] = patch;
        continue;
      }

      const allCaughtUp = (Object.keys(patch) as (keyof InquiryOptimisticPatch)[]).every(
        (field) => !(field in serverRow) || serverRow[field] === patch[field]
      );

      if (allCaughtUp) {
        changed = true;
      } else {
        next[id] = patch;
      }
    }

    return changed ? next : prev;
  }

  it("drops a patch entry when the server row now reflects all patched fields", () => {
    const patches: Record<string, InquiryOptimisticPatch> = {
      a: { status: "booked", total: 5000 },
    };
    // Server has caught up: both patched fields now match.
    const serverRows = [{ id: "a", status: "booked", total: 5000, name: "Alice" }];
    const result = reconcile(patches, serverRows);
    expect(Object.keys(result)).toHaveLength(0);
    // Overlay is gone — applyOptimisticPatch would now return the raw server row.
    expect(applyOptimisticPatch(serverRows, result)[0].status).toBe("booked");
  });

  it("keeps the patch when the server row has not yet caught up on all fields", () => {
    const patches: Record<string, InquiryOptimisticPatch> = {
      b: { status: "booked", total: 9000 },
    };
    // Server reflects status but total is still stale.
    const serverRows = [{ id: "b", status: "booked", total: 0, name: "Bob" }];
    const result = reconcile(patches, serverRows);
    expect(result["b"]).toEqual(patches["b"]);
  });

  it("returns the same reference (no-op) when no patch is pruned", () => {
    const patches: Record<string, InquiryOptimisticPatch> = {
      c: { status: "archived" },
    };
    const serverRows = [{ id: "c", status: "inquiry", name: "Carol" }];
    const result = reconcile(patches, serverRows);
    // Identity check: same object reference means setState would not trigger a re-render.
    expect(result).toBe(patches);
  });

  it("prunes only the caught-up entry and keeps pending ones", () => {
    const patches: Record<string, InquiryOptimisticPatch> = {
      a: { status: "booked" },
      b: { status: "archived" },
    };
    const serverRows = [
      { id: "a", status: "booked", name: "Alice" }, // caught up
      { id: "b", status: "inquiry", name: "Bob" },  // still stale
    ];
    const result = reconcile(patches, serverRows);
    expect(Object.keys(result)).toEqual(["b"]);
    expect(result["b"]).toEqual({ status: "archived" });
  });

  it("prunes a phone-only patch because phone is absent from the server row", () => {
    // InquiryRow only carries `status`; phone/notes/total are not rendered columns.
    // A patch with only non-row fields should be pruned so the map does not grow unbounded.
    const patches: Record<string, InquiryOptimisticPatch> = {
      a: { phone: "+63912345678" },
    };
    const serverRows = [{ id: "a", status: "inquiry", name: "Alice" }];
    const result = reconcile(patches, serverRows);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("keeps a status patch when the server row status has not caught up yet", () => {
    // Ensures the !(field in serverRow) branch does not prune status,
    // which IS on the server row and must reconcile by value.
    const patches: Record<string, InquiryOptimisticPatch> = {
      b: { status: "booked" },
    };
    const serverRows = [{ id: "b", status: "inquiry", name: "Bob" }];
    const result = reconcile(patches, serverRows);
    expect(result["b"]).toEqual({ status: "booked" });
  });

  it("prunes a mixed phone+status patch once the status field has also caught up", () => {
    const patches: Record<string, InquiryOptimisticPatch> = {
      a: { phone: "+63912345678", status: "booked" },
    };
    const serverRows = [{ id: "a", status: "booked", name: "Alice" }];
    const result = reconcile(patches, serverRows);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
