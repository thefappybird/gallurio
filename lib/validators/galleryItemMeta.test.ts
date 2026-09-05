import { describe, it, expect } from "vitest";
import { z } from "zod";
import { GALLERY_DATE_RE, galleryMetaRowSchema, galleryItemMetaFields } from "./galleryItemMeta";

const schema = z.object(galleryItemMetaFields);

describe("GALLERY_DATE_RE", () => {
  it("accepts '' and a plain YYYY-MM-DD date", () => {
    expect(GALLERY_DATE_RE.test("")).toBe(true);
    expect(GALLERY_DATE_RE.test("2026-06-15")).toBe(true);
  });
  it("rejects other formats", () => {
    expect(GALLERY_DATE_RE.test("06/15/2026")).toBe(false);
    expect(GALLERY_DATE_RE.test("2026-6-15")).toBe(false);
    expect(GALLERY_DATE_RE.test("not-a-date")).toBe(false);
  });
});

describe("galleryItemMetaFields", () => {
  it("accepts every field omitted (all optional)", () => {
    expect(schema.safeParse({}).success).toBe(true);
  });
  it("rejects a malformed date", () => {
    const r = schema.safeParse({ date: "15-06-2026" });
    expect(r.success).toBe(false);
  });
  it("caps meta at 20 rows", () => {
    const meta = Array.from({ length: 21 }, (_, i) => ({ label: `L${i}`, value: `V${i}` }));
    expect(schema.safeParse({ meta }).success).toBe(false);
    expect(schema.safeParse({ meta: meta.slice(0, 20) }).success).toBe(true);
  });
  it("caps meta label/value at 120 chars", () => {
    expect(galleryMetaRowSchema.safeParse({ label: "a".repeat(121), value: "v" }).success).toBe(false);
    expect(galleryMetaRowSchema.safeParse({ label: "a".repeat(120), value: "v" }).success).toBe(true);
  });
  it("caps tags at 20 entries of max 40 chars", () => {
    expect(schema.safeParse({ tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }).success).toBe(false);
    expect(schema.safeParse({ tags: ["a".repeat(41)] }).success).toBe(false);
    expect(schema.safeParse({ tags: ["a".repeat(40)] }).success).toBe(true);
  });
});
