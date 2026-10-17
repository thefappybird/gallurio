import { describe, expect, it } from "vitest";
import { importProgressPercent } from "./import-progress-ring";

describe("importProgressPercent", () => {
  it("stays within 0–100 and reserves 100 for completed groups", () => {
    expect(importProgressPercent(0, 0)).toBe(0);
    expect(importProgressPercent(0, 200)).toBe(0);
    expect(importProgressPercent(199, 200)).toBe(99);
    expect(importProgressPercent(200, 200)).toBe(100);
    expect(importProgressPercent(201, 200)).toBe(100);
    expect(importProgressPercent(-1, 200)).toBe(0);
  });
});
