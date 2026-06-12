import { describe, it, expect } from "vitest";
import { createDraftSchema, updateDraftSchema } from "./portfolioDraft";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

const snapshot = {
  templateId: "minimal",
  data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
  brandKit: DEFAULT_BRAND_KIT,
  contact: {},
  header: {},
  collectionsPopup: {},
  formLocale: "",
};

describe("createDraftSchema", () => {
  it("accepts a valid snapshot with a name", () => {
    const r = createDraftSchema.safeParse({ name: "My Draft", ...snapshot });
    expect(r.success).toBe(true);
  });

  it("rejects an empty/whitespace name with name_required", () => {
    const r = createDraftSchema.safeParse({ name: "   ", ...snapshot });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.errors[0]?.message).toBe("name_required");
  });
});

describe("updateDraftSchema", () => {
  it("requires an id", () => {
    const r = updateDraftSchema.safeParse({ name: "X", ...snapshot });
    expect(r.success).toBe(false);
  });

  it("accepts id + name + snapshot", () => {
    const r = updateDraftSchema.safeParse({ id: "abc123", name: "X", ...snapshot });
    expect(r.success).toBe(true);
  });
});
