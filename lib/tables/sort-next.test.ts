import { describe, expect, it } from "vitest";
import { nextSortDir } from "./sort-next";

describe("nextSortDir", () => {
  it("flips the direction when the active column is clicked", () => {
    expect(nextSortDir("bookings", "title", "asc", "title")).toBe("desc");
  });

  it("uses the new column's natural direction when switching columns", () => {
    expect(nextSortDir("bookings", "title", "asc", "total")).toBe("desc");
    expect(nextSortDir("inquiries", "submitted", "desc", "client")).toBe("asc");
  });
});
