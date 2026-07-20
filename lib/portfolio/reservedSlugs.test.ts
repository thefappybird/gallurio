import { describe, expect, it } from "vitest";
import { isReservedSlug } from "./reservedSlugs";

describe("isReservedSlug", () => {
  it("returns true for a reserved infra label like www", () => {
    expect(isReservedSlug("www")).toBe(true);
  });
});
