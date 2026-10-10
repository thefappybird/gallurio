import { describe, expect, it } from "vitest";
import { parseFitCookie, resolveLimit, resolvePageSize } from "./page-fit";

describe("parseFitCookie", () => {
  it("accepts positive integers only", () => {
    expect(parseFitCookie("14")).toBe(14);
    expect(parseFitCookie(undefined)).toBeUndefined();
    expect(parseFitCookie("0")).toBeUndefined();
    expect(parseFitCookie("-3")).toBeUndefined();
    expect(parseFitCookie("1.5")).toBeUndefined();
    expect(parseFitCookie("abc")).toBeUndefined();
  });
});

describe("resolvePageSize", () => {
  it("defaults to 10 with the standard options", () => {
    expect(resolvePageSize()).toEqual({ base: 10, options: [10, 20, 30, 50] });
  });

  it("clamps to 10..50 and keeps only larger standard options", () => {
    expect(resolvePageSize(4).base).toBe(10);
    expect(resolvePageSize(14)).toEqual({ base: 14, options: [14, 20, 30, 50] });
    expect(resolvePageSize(25)).toEqual({ base: 25, options: [25, 30, 50] });
    expect(resolvePageSize(99)).toEqual({ base: 50, options: [50] });
  });
});

describe("resolveLimit", () => {
  it("uses the raw limit when in options, else base", () => {
    expect(resolveLimit("20", 14)).toBe(20);
    expect(resolveLimit("10", 14)).toBe(14);
    expect(resolveLimit("zzz", 14)).toBe(14);
    expect(resolveLimit(undefined)).toBe(10);
  });
});
