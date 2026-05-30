import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES } from "@/lib/validators/booking";
import { STATUS_COLOR_VAR, STATUS_ORDER } from "./status-style";

describe("status-style", () => {
  it("maps every booking status to a css var", () => {
    for (const status of BOOKING_STATUSES) {
      expect(STATUS_COLOR_VAR[status]).toMatch(/^var\(--event-[a-z]+\)$/);
    }
  });

  it("has no extra keys beyond the known statuses", () => {
    expect(Object.keys(STATUS_COLOR_VAR).sort()).toEqual(
      [...BOOKING_STATUSES].sort()
    );
  });

  it("STATUS_ORDER covers all statuses exactly once", () => {
    expect([...STATUS_ORDER].sort()).toEqual([...BOOKING_STATUSES].sort());
    expect(STATUS_ORDER.length).toBe(BOOKING_STATUSES.length);
  });
});
