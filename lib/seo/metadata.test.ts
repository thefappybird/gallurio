import { describe, it, expect } from "vitest";
import { localeUrl, marketingMetadata } from "./metadata";

describe("localeUrl()", () => {
  it("leaves the default locale unprefixed and prefixes the rest", () => {
    expect(localeUrl("en", "/pricing")).toBe("http://localhost:3000/pricing");
    expect(localeUrl("fil", "/pricing")).toBe("http://localhost:3000/fil/pricing");
  });
});

describe("marketingMetadata()", () => {
  it("canonicalises to the requested locale", () => {
    const meta = marketingMetadata({ locale: "fil", path: "/pricing", title: "T", description: "D" });

    expect(meta.alternates?.canonical).toBe("http://localhost:3000/fil/pricing");
  });

  it("lists every locale plus x-default in hreflang", () => {
    const meta = marketingMetadata({ locale: "en", path: "/pricing", title: "T", description: "D" });

    expect(meta.alternates?.languages).toEqual({
      en: "http://localhost:3000/pricing",
      fil: "http://localhost:3000/fil/pricing",
      id: "http://localhost:3000/id/pricing",
      ar: "http://localhost:3000/ar/pricing",
      th: "http://localhost:3000/th/pricing",
      "x-default": "http://localhost:3000/pricing",
    });
  });

  it("keeps the page title absolute so the layout template does not append twice", () => {
    const meta = marketingMetadata({
      locale: "en",
      path: "/pricing",
      title: "Pricing",
      description: "What Gallurio costs.",
    });

    expect(meta.title).toEqual({ absolute: "Pricing" });
    expect(meta.description).toBe("What Gallurio costs.");
  });
});
