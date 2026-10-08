import { describe, expect, it } from "vitest";
import { parseSort } from "./sort";

describe("parseSort", () => {
  it("unknown key falls back to default key and dir even if dir given", () => {
    expect(parseSort("inquiries", { sort: "nope", dir: "asc" })).toMatchObject({
      key: "submitted",
      dir: "desc",
      field: "createdAt",
    });
  });

  it("unknown dir falls back to natural dir (text asc, dates desc); valid dir honored", () => {
    expect(parseSort("bookings", { sort: "title", dir: "x" }).dir).toBe("asc");
    expect(parseSort("bookings", { sort: "date", dir: "x" }).dir).toBe("desc");
    expect(parseSort("bookings", { sort: "title", dir: "desc" })).toMatchObject({
      dir: "desc",
      text: true,
      field: "title",
    });
    expect(parseSort("bookings", { sort: "total" }).field).toBe("amount.total");
  });

  it("bookings default is bookedAt desc and not explicit", () => {
    expect(parseSort("bookings", {})).toEqual({
      key: "bookedAt",
      dir: "desc",
      field: "bookedAt",
      text: false,
      explicit: false,
    });
  });

  it("explicit is true only for a valid sort key", () => {
    expect(parseSort("bookings", { sort: "title" }).explicit).toBe(true);
    expect(parseSort("bookings", { sort: "nope" }).explicit).toBe(false);
  });
});
