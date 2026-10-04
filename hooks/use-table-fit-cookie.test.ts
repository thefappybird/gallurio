import { describe, expect, it } from "vitest";
import { nextFitCookie } from "./use-table-fit-cookie";

describe("nextFitCookie", () => {
  it("returns a cookie string when the fit differs from the stored value", () => {
    expect(nextFitCookie("bookings", 14, "a=1; gw_table_fit_bookings=12")).toBe(
      "gw_table_fit_bookings=14; SameSite=Lax; max-age=31536000; path=/"
    );
  });

  it("returns null when the stored value already matches", () => {
    expect(nextFitCookie("clients", 12, "gw_table_fit_clients=12")).toBeNull();
  });
});
