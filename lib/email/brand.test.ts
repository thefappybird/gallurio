import { describe, it, expect } from "vitest";
import { gallurioBrand, resolveWorkspaceBrand, ctaTextColor } from "./brand";

const GALLURIO_TEAL = "#0d8fa1";

describe("brand", () => {
  it("gallurioBrand is the fixed platform brand with the Gallurio mark", () => {
    const b = gallurioBrand();
    expect(b.kind).toBe("platform");
    expect(b.name).toBe("Gallurio");
    expect(b.accentHex).toBe(GALLURIO_TEAL);
    expect(b.poweredByGallurio).toBe(false);
    expect(b.logoUrl).toBe("https://gallurio.com/brand/gallurio-sq-white.png");
  });
  it("resolveWorkspaceBrand reads logoUrl from the top-level workspace field, not publicPage.header", () => {
    const b = resolveWorkspaceBrand({
      name: "Aperture Studio",
      logoUrl: "https://imagedelivery.net/biz/logo/public",
      publicPage: { header: { logoUrl: "https://imagedelivery.net/x/y/public" }, brandKit: { accentColor: "#2f5d56" } },
      contact: { email: "hi@aperture.test" },
    });
    expect(b).toMatchObject({
      kind: "partner", name: "Aperture Studio",
      // emailSafeImageUrl forces a PNG variant for imagedelivery.net URLs.
      logoUrl: "https://imagedelivery.net/biz/logo/public,f=png",
      accentHex: "#2f5d56", replyTo: "hi@aperture.test", poweredByGallurio: true,
    });
  });
  it("falls back to teal accent and undefined logo when missing/invalid", () => {
    const b = resolveWorkspaceBrand({ name: "No Brand", publicPage: { brandKit: { accentColor: "not-a-hex" } } });
    expect(b.accentHex).toBe(GALLURIO_TEAL);
    expect(b.logoUrl).toBeUndefined();
    expect(b.name).toBe("No Brand");
  });
  it("ignores publicPage.header.logoUrl (portfolio nav logo is not the email brand logo)", () => {
    const b = resolveWorkspaceBrand({
      name: "Aperture Studio",
      publicPage: { header: { logoUrl: "https://imagedelivery.net/x/y/public" } },
    });
    expect(b.logoUrl).toBeUndefined();
  });
  it("uses a PNG Cloudflare variant for email-safe workspace logos", () => {
    const b = resolveWorkspaceBrand({
      name: "Aperture Studio",
      logoUrl: "https://imagedelivery.net/account/logo-id/w=256,h=256,fit=scale-down,q=85,f=auto",
    });
    expect(b.logoUrl).toBe(
      "https://imagedelivery.net/account/logo-id/w=256,h=256,fit=scale-down,q=85,f=png"
    );
  });
  it("ctaTextColor picks readable text by luminance", () => {
    expect(ctaTextColor("#0d8fa1")).toBe("#ffffff"); // dark teal -> white
    expect(ctaTextColor("#ffe08a")).toBe("#1a1a1a"); // light yellow -> dark
  });
});
