import { describe, it, expect } from "vitest";
import { sanitizeLocalReturnTo } from "./localReturnTo";

describe("sanitizeLocalReturnTo", () => {
  it("accepts a local path", () => {
    expect(sanitizeLocalReturnTo("/inquiries?inquiryId=abc")).toBe("/inquiries?inquiryId=abc");
  });

  it("rejects undefined/empty", () => {
    expect(sanitizeLocalReturnTo(undefined)).toBeUndefined();
    expect(sanitizeLocalReturnTo(null)).toBeUndefined();
    expect(sanitizeLocalReturnTo("")).toBeUndefined();
  });

  it("rejects protocol-relative open-redirect attempts", () => {
    expect(sanitizeLocalReturnTo("//evil.com")).toBeUndefined();
    expect(sanitizeLocalReturnTo("/\\evil.com")).toBeUndefined();
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeLocalReturnTo("https://evil.com")).toBeUndefined();
  });

  it("rejects a path not starting with /", () => {
    expect(sanitizeLocalReturnTo("evil.com")).toBeUndefined();
  });
});
