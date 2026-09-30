import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./pagination";

describe("pagination constants", () => {
  it("DEFAULT_PAGE_SIZE matches the first (smallest) page size option", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(PAGE_SIZE_OPTIONS[0]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });
});
