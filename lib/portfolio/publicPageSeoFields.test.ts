import { describe, expect, it } from "vitest";
import {
  normalizeDraftSeoFields,
  normalizePublishedSeoFields,
  hasPendingSeoChanges,
} from "./publicPageSeoFields";

describe("normalizeDraftSeoFields", () => {
  it("defaults every field for a null/undefined input", () => {
    expect(normalizeDraftSeoFields(null)).toEqual({
      seoTitle: "",
      seoDescription: "",
      siteIconUrl: "",
      siteIconAssetId: "",
      seo: {
        keywords: [],
        ogImageUrl: "",
        ogImageAssetId: "",
        galleryDescription: "",
        noindex: false,
      },
    });
    expect(normalizeDraftSeoFields(undefined)).toEqual(normalizeDraftSeoFields(null));
  });

  it("carries through populated fields", () => {
    const result = normalizeDraftSeoFields({
      seoTitle: "Title",
      seoDescription: "Desc",
      siteIcon: { url: "https://x/icon.png", assetId: "asset-1" },
      seo: {
        ogImageUrl: "https://x/og.png",
        ogImageAssetId: "asset-2",
        galleryDescription: "Gallery desc",
        noindex: true,
        keywords: ["a", "b"],
      },
    });
    expect(result).toEqual({
      seoTitle: "Title",
      seoDescription: "Desc",
      siteIconUrl: "https://x/icon.png",
      siteIconAssetId: "asset-1",
      seo: {
        keywords: ["a", "b"],
        ogImageUrl: "https://x/og.png",
        ogImageAssetId: "asset-2",
        galleryDescription: "Gallery desc",
        noindex: true,
      },
    });
  });
});

describe("normalizePublishedSeoFields", () => {
  it("normalizes identically to the draft normalizer", () => {
    const input = { seoTitle: "T", seo: { keywords: ["x"] } };
    expect(normalizePublishedSeoFields(input)).toEqual(normalizeDraftSeoFields(input));
  });
});

describe("hasPendingSeoChanges", () => {
  it("returns false for identical bundles", () => {
    const a = normalizeDraftSeoFields({ seoTitle: "T", seo: { keywords: ["a", "b"] } });
    const b = normalizeDraftSeoFields({ seoTitle: "T", seo: { keywords: ["a", "b"] } });
    expect(hasPendingSeoChanges(a, b)).toBe(false);
  });

  it("returns true when a scalar field differs", () => {
    const a = normalizeDraftSeoFields({ seoTitle: "T1" });
    const b = normalizeDraftSeoFields({ seoTitle: "T2" });
    expect(hasPendingSeoChanges(a, b)).toBe(true);
  });

  it("returns true when keyword order differs", () => {
    const a = normalizeDraftSeoFields({ seo: { keywords: ["a", "b"] } });
    const b = normalizeDraftSeoFields({ seo: { keywords: ["b", "a"] } });
    expect(hasPendingSeoChanges(a, b)).toBe(true);
  });
});
