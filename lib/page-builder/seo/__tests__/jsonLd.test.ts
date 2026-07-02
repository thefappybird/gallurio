import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/portfolio/publicUrl", () => ({
  portfolioPublicUrl: (slug: string) => `http://localhost:3000/w/${slug}`,
}));

import { resolveSchemaType, buildHomeJsonLd } from "../jsonLd";

describe("resolveSchemaType", () => {
  it("maps photographer to PhotographyBusiness", () => {
    expect(resolveSchemaType("photographer")).toBe("PhotographyBusiness");
  });
  it("maps venue to EventVenue", () => {
    expect(resolveSchemaType("venue")).toBe("EventVenue");
  });
  it("maps stylist to HairSalon", () => {
    expect(resolveSchemaType("stylist")).toBe("HairSalon");
  });
});

describe("buildHomeJsonLd", () => {
  it("returns a LocalBusiness block with correct @type and url", () => {
    const [lb] = buildHomeJsonLd({ name: "Studio A", slug: "studio-a" });
    expect(lb["@type"]).toBe("LocalBusiness");
    expect(lb.url).toBe("http://localhost:3000/w/studio-a");
  });
  it("applies businessType to set @type", () => {
    const [lb] = buildHomeJsonLd({ name: "Photo Co", slug: "photo-co", businessType: "photographer" });
    expect(lb["@type"]).toBe("PhotographyBusiness");
  });
  it("omits email when not provided", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x" });
    expect(lb).not.toHaveProperty("email");
  });
  it("includes email when provided", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x", email: "hi@studio.com" });
    expect(lb.email).toBe("hi@studio.com");
  });
  it("joins keywords into a comma-delimited string when provided", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x", keywords: ["wedding", "bali"] });
    expect(lb.keywords).toBe("wedding, bali");
  });
  it("omits keywords when absent or empty", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x" });
    expect(lb).not.toHaveProperty("keywords");
    const [lb2] = buildHomeJsonLd({ name: "X", slug: "x", keywords: [] });
    expect(lb2).not.toHaveProperty("keywords");
  });
});

import { buildGalleryJsonLd, safeJsonLd } from "../jsonLd";

describe("buildGalleryJsonLd", () => {
  it("returns ImageGallery block with correct name and url", () => {
    const [ig] = buildGalleryJsonLd({ name: "Studio A", slug: "studio-a" });
    expect(ig["@type"]).toBe("ImageGallery");
    expect(ig.url).toBe("http://localhost:3000/w/studio-a/gallery");
    expect(ig.name).toBe("Studio A — Gallery");
  });
});

describe("safeJsonLd", () => {
  it("serialises data and escapes </script> to prevent XSS", () => {
    const result = safeJsonLd({ evil: "</script><script>alert(1)</script>" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("<\\/script>");
  });

  it("escapes </script > (whitespace variant) which HTML5 also treats as a script end tag", () => {
    // HTML5 ends a <script> element on </script followed by whitespace, /, or >.
    // A workspace owner could inject this to break out of the JSON-LD block.
    const result = safeJsonLd({ name: "evil</script ><script>alert(1)</script>" });
    expect(result).not.toContain("</script");
  });

  it("escapes </script/> (self-closing variant)", () => {
    const result = safeJsonLd({ name: "evil</script/><script>alert(1)</script>" });
    expect(result).not.toContain("</script");
  });

  it("escapes case-insensitive variants like </SCRIPT>", () => {
    const result = safeJsonLd({ name: "evil</SCRIPT><script>alert(1)</script>" });
    expect(result).not.toContain("</script");
    expect(result).not.toContain("</SCRIPT");
  });
});
