import { describe, expect, it } from "vitest";
import { consumeDirty, routesToMark } from "./dirty-routes";

describe("routesToMark", () => {
  const routes = ["/bookings", "/dashboard", "/clients"];

  it("when the current page is refreshed now, marks only the routes it does not cover", () => {
    expect(routesToMark(routes, "/fil/bookings", true)).toEqual(["/dashboard", "/clients"]);
  });

  it("when no refresh runs (refresh:false or unaffected page), marks every route", () => {
    expect(routesToMark(routes, "/bookings", false)).toEqual(routes);
    expect(routesToMark(routes, "/settings", false)).toEqual(routes);
  });
});

describe("consumeDirty", () => {
  it("returns true and empties the set when the pathname matches a dirty route (refresh clears the whole client cache)", () => {
    const dirty = new Set(["/bookings", "/clients"]);
    expect(consumeDirty(dirty, "/th/bookings/b1")).toBe(true);
    expect(dirty.size).toBe(0);
  });

  it("returns false and leaves the set untouched when nothing matches", () => {
    const dirty = new Set(["/clients"]);
    expect(consumeDirty(dirty, "/settings")).toBe(false);
    expect([...dirty]).toEqual(["/clients"]);
  });
});
