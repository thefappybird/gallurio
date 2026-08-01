import { describe, expect, it } from "vitest";
import { groupImportRows } from "./import-grouping";

describe("groupImportRows", () => {
  it("collapses rows sharing a bookingId into one multi-session group", () => {
    // This is what makes an exported multi-session booking round-trip instead
    // of exploding into N single-session bookings.
    const groups = groupImportRows([
      { bookingId: "b1", sessionIndex: "1", title: "Wedding" },
      { bookingId: "b1", sessionIndex: "0", title: "Wedding" },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].bookingId).toBe("b1");
    // Ordered by sessionIndex, not file order.
    expect(groups[0].rows.map((r) => r.sessionIndex)).toEqual(["0", "1"]);
    expect(groups[0].rowNumbers).toEqual([2, 1]);
  });

  it("keeps rows without a bookingId as separate single-session groups", () => {
    // Pre-existing behaviour for hand-authored files must not change.
    const groups = groupImportRows([
      { title: "One", clientName: "Ana" },
      { title: "Two", clientName: "Bea" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.bookingId === null && g.rows.length === 1)).toBe(true);
    expect(groups.map((g) => g.rowNumbers[0])).toEqual([1, 2]);
  });

  it("flags a group that exceeds the session cap", () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      bookingId: "b1",
      sessionIndex: String(i),
    }));
    expect(groupImportRows(rows)[0].error).toBe("too_many_sessions");
  });
});
