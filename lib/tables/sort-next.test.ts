import { describe, expect, it } from "vitest";
import { nextSort } from "./sort-next";

describe("nextSort", () => {
  it("unsorted -> clicked column asc", () => {
    expect(nextSort(null, "desc", "total")).toEqual({ key: "total", dir: "asc" });
  });

  it("asc -> desc -> reset on the same column", () => {
    expect(nextSort("title", "asc", "title")).toEqual({ key: "title", dir: "desc" });
    expect(nextSort("title", "desc", "title")).toBeNull();
  });

  it("different column starts asc regardless of natural dir", () => {
    expect(nextSort("title", "desc", "date")).toEqual({ key: "date", dir: "asc" });
  });
});
