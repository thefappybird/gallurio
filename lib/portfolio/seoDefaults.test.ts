import { describe, it, expect } from "vitest";
import { resolveHomeSeo, resolveGallerySeo } from "./seoDefaults";

describe("resolveHomeSeo", () => {
  it("passes a configured title through byte-identical after trim", () => {
    const r = resolveHomeSeo({
      name: "Luna Studio",
      seoTitle: "  Luna Wedding Photography  ",
      seoDescription: "Award-winning wedding photographer in Manila",
      defaultDescription: "default",
    });
    expect(r.title).toBe("Luna Wedding Photography");
  });

  it("falls back title to workspace name when seoTitle is blank", () => {
    const r = resolveHomeSeo({ name: "Luna Studio", seoTitle: "", defaultDescription: "default" });
    expect(r.title).toBe("Luna Studio");
  });

  it("falls back title to workspace name when seoTitle is whitespace-only", () => {
    const r = resolveHomeSeo({ name: "Luna Studio", seoTitle: "   ", defaultDescription: "default" });
    expect(r.title).toBe("Luna Studio");
  });

  it("passes a configured description through byte-identical after trim, isDefaulted false", () => {
    const r = resolveHomeSeo({
      name: "Luna Studio",
      seoDescription: "  Award-winning wedding photographer in Manila  ",
      defaultDescription: "default",
    });
    expect(r.description).toBe("Award-winning wedding photographer in Manila");
    expect(r.isDefaulted).toBe(false);
  });

  it("uses defaultDescription and marks isDefaulted when seoDescription is blank", () => {
    const r = resolveHomeSeo({ name: "Luna Studio", seoDescription: "", defaultDescription: "Luna Studio default" });
    expect(r.description).toBe("Luna Studio default");
    expect(r.isDefaulted).toBe(true);
  });

  it("treats whitespace-only seoDescription as blank", () => {
    const r = resolveHomeSeo({ name: "Luna Studio", seoDescription: "   ", defaultDescription: "def" });
    expect(r.description).toBe("def");
    expect(r.isDefaulted).toBe(true);
  });

  it("never returns an empty title even with no name-derived fallback issues", () => {
    const r = resolveHomeSeo({ name: "X", defaultDescription: "def" });
    expect(r.title).toBe("X");
  });
});

describe("resolveGallerySeo", () => {
  const galleryTitle = "Luna Studio — Gallery";

  it("passes galleryDescription through byte-identical after trim, isDefaulted false", () => {
    const r = resolveGallerySeo({
      name: "Luna Studio",
      galleryDescription: "  Manila wedding gallery  ",
      defaultDescription: "def",
      galleryTitle,
    });
    expect(r.description).toBe("Manila wedding gallery");
    expect(r.isDefaulted).toBe(false);
    expect(r.title).toBe(galleryTitle);
  });

  it("falls back to seoDescription when galleryDescription is blank", () => {
    const r = resolveGallerySeo({
      name: "Luna Studio",
      galleryDescription: "",
      seoDescription: "Home description",
      defaultDescription: "def",
      galleryTitle,
    });
    expect(r.description).toBe("Home description");
    expect(r.isDefaulted).toBe(false);
  });

  it("falls back to defaultDescription when both galleryDescription and seoDescription are blank", () => {
    const r = resolveGallerySeo({
      name: "Luna Studio",
      galleryDescription: "  ",
      seoDescription: "  ",
      defaultDescription: "Gallery default",
      galleryTitle,
    });
    expect(r.description).toBe("Gallery default");
    expect(r.isDefaulted).toBe(true);
  });

  it("Gallery's default description differs from Home's default", () => {
    const home = resolveHomeSeo({ name: "Luna Studio", defaultDescription: "HOME DEFAULT" });
    const gallery = resolveGallerySeo({ name: "Luna Studio", defaultDescription: "GALLERY DEFAULT", galleryTitle });
    expect(gallery.description).not.toBe(home.description);
  });

  it("precedence is galleryDescription over seoDescription over default", () => {
    const r = resolveGallerySeo({
      name: "Luna Studio",
      galleryDescription: "Gallery-specific",
      seoDescription: "Home-level",
      defaultDescription: "def",
      galleryTitle,
    });
    expect(r.description).toBe("Gallery-specific");
  });
});
