import { describe, it, expect } from "vitest";
import { gallurioBrand, resolveWorkspaceBrand, ctaTextColor } from "./brand";

const GALLURIO_TEAL = "#0d8fa1";

describe("brand", () => {
  it("gallurioBrand is the fixed platform brand", () => {
    const b = gallurioBrand();
    expect(b.kind).toBe("platform");
    expect(b.name).toBe("Gallurio");
    expect(b.accentHex).toBe(GALLURIO_TEAL);
    expect(b.poweredByGallurio).toBe(false);
  });
  it("resolveWorkspaceBrand uses workspace fields with fallbacks", () => {
    const b = resolveWorkspaceBrand({
      name: "Aperture Studio",
      publicPage: { header: { logoUrl: "https://imagedelivery.net/x/y/public" }, brandKit: { accentColor: "#2f5d56" } },
      contact: { email: "hi@aperture.test" },
    });
    expect(b).toMatchObject({
      kind: "partner", name: "Aperture Studio",
      logoUrl: "https://imagedelivery.net/x/y/public",
      accentHex: "#2f5d56", replyTo: "hi@aperture.test", poweredByGallurio: true,
    });
  });
  it("falls back to teal accent and undefined logo when missing/invalid", () => {
    const b = resolveWorkspaceBrand({ name: "No Brand", publicPage: { brandKit: { accentColor: "not-a-hex" } } });
    expect(b.accentHex).toBe(GALLURIO_TEAL);
    expect(b.logoUrl).toBeUndefined();
    expect(b.name).toBe("No Brand");
  });
  it("ctaTextColor picks readable text by luminance", () => {
    expect(ctaTextColor("#0d8fa1")).toBe("#ffffff"); // dark teal -> white
    expect(ctaTextColor("#ffe08a")).toBe("#1a1a1a"); // light yellow -> dark
  });
});
