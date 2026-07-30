import { describe, expect, it } from "vitest";
import { parseBookingsToggleFilters } from "./booking-filters";

describe("parseBookingsToggleFilters", () => {
  it("defaults both flags to true when params are absent (opt-out convention)", () => {
    const flags = parseBookingsToggleFilters({});
    expect(flags).toEqual({ includeCancelled: true, includePast: true });
  });

  it("flips a flag to false only when its param is exactly \"0\"", () => {
    const flags = parseBookingsToggleFilters({ includeCancelled: "0", showPast: "0" });
    expect(flags).toEqual({ includeCancelled: false, includePast: false });
  });
});
