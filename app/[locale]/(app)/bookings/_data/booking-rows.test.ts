import { describe, it, expect } from "vitest";
import { bookingRowAmount } from "./booking-rows";

describe("bookingRowAmount", () => {
  it("prefers the rate frozen on the booking when it targets the workspace currency", () => {
    const row = bookingRowAmount(
      { total: 1000, currency: "SGD", fxRate: 48.44, fxTarget: "PHP" },
      { PHP: 1, SGD: 40 },
      "PHP"
    );

    expect(row).toEqual({ total: 48440, currency: "PHP" });
  });

  it("falls back to the live rate map when the booking has no frozen rate", () => {
    const row = bookingRowAmount({ total: 1000, currency: "SGD" }, { PHP: 1, SGD: 40 }, "PHP");

    expect(row).toEqual({ total: 40000, currency: "PHP" });
  });
});
