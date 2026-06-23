import { describe, it, expect } from "vitest";
import { renderBrandedEmail, bilingualSubject, renderBilingualEmail } from "./layout";
import { gallurioBrand, resolveWorkspaceBrand } from "./brand";

describe("renderBrandedEmail", () => {
  const base = { locale: "en" as const, preheader: "pre", title: "Hello", blocks: [{ type: "p" as const, text: "Hi <there>" }] };

  it("escapes user text and renders both html and text", () => {
    const { html, text } = renderBrandedEmail({ brand: gallurioBrand(), ...base });
    expect(html).toContain("Hi &lt;there&gt;");
    expect(html).not.toContain("Hi <there>");
    expect(text).toContain("Hi <there>"); // plain text keeps raw
    expect(html).toContain("Gallurio");
  });
  it("renders primary + secondary CTA with escaped url", () => {
    const { html } = renderBrandedEmail({ brand: gallurioBrand(), ...base,
      cta: { label: "Go", url: "https://x.test/a?b=1&c=2" },
      secondaryCta: { label: "More", url: "https://x.test/m" } });
    expect(html).toContain("https://x.test/a?b=1&amp;c=2");
    expect(html).toContain(">Go<");
    expect(html).toContain(">More<");
  });
  it("partner brand shows business name + Powered by Gallurio", () => {
    const brand = resolveWorkspaceBrand({ name: "Aperture", contact: { email: "h@a.test" } });
    const { html } = renderBrandedEmail({ brand, ...base });
    expect(html).toContain("Aperture");
    expect(html).toMatch(/Powered by\s*Gallurio/i);
  });
  it("includes a dark-mode style block and the preheader", () => {
    const { html } = renderBrandedEmail({ brand: gallurioBrand(), ...base });
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("pre");
  });
  it("dark-mode media block overrides text with !important and text elements carry email-text class", () => {
    const { html } = renderBrandedEmail({
      brand: gallurioBrand(),
      ...base,
      subtitle: "A subtitle",
      blocks: [
        { type: "p", text: "paragraph" },
        { type: "heading", text: "Section" },
        { type: "rows", rows: [{ label: "Date", value: "2026-01-01" }] },
      ],
    });
    // Dark-mode rules must use !important so they win over inline color styles
    expect(html).toMatch(/\.email-text\s*\{[^}]*!important/);
    expect(html).toMatch(/\.email-label\s*\{[^}]*!important/);
    // All text-bearing elements must carry the class the dark rule targets
    expect(html).toContain('class="email-text"'); // h1, p, h2, td value
    expect(html).toContain('class="email-label"'); // td label
  });
});

describe("divider block", () => {
  it("renders email-divider class, label text, and plain-text marker", () => {
    const { html, text } = renderBrandedEmail({
      brand: gallurioBrand(),
      locale: "en",
      preheader: "pre",
      title: "T",
      blocks: [{ type: "divider", label: "Filipino" }],
    });
    expect(html).toContain("Filipino");
    expect(html).toContain("email-divider");
    expect(text).toContain("--- Filipino ---");
  });
});

describe("bilingualSubject", () => {
  it("returns en unchanged when locale is en, same when strings match, and middot-joined when locale differs", () => {
    expect(bilingualSubject("Hello", "Hello", "en")).toBe("Hello");
    expect(bilingualSubject("Hello", "Kumusta", "en")).toBe("Hello");
    expect(bilingualSubject("Hello", "Hello", "fil")).toBe("Hello");
    expect(bilingualSubject("A", "B", "fil")).toBe("A · B");
    expect(bilingualSubject("A", "B", "ms")).toBe("A · B");
    expect(bilingualSubject("A", "B", "id")).toBe("A · B");
  });
});

describe("renderBilingualEmail", () => {
  it("with secondaryLocale en renders single pass (no divider element)", () => {
    const { html } = renderBilingualEmail({
      brand: gallurioBrand(),
      preheader: "pre",
      secondaryLocale: "en",
      build: () => ({ title: "English Only", blocks: [{ type: "p", text: "content" }] }),
    });
    expect(html).toContain("English Only");
    // The CSS rule for .email-divider is always present, but no divider <td class="email-divider"> element should be rendered
    expect(html).not.toMatch(/class="email-divider"/);
  });

  it("with secondaryLocale fil renders both sections with divider, English first", () => {
    const { html } = renderBilingualEmail({
      brand: gallurioBrand(),
      preheader: "pre",
      secondaryLocale: "fil",
      build: (loc) => ({
        title: loc === "en" ? "Hello" : "Kumusta",
        blocks: [{ type: "p", text: loc === "en" ? "Hi there" : "Kumusta po" }],
      }),
    });
    expect(html).toContain("Hello");
    expect(html).toContain("Kumusta");
    expect(html).toContain("Hi there");
    expect(html).toContain("Kumusta po");
    expect(html).toMatch(/class="email-divider"/);
    expect(html).toContain("Filipino");
    // English content must appear before Filipino content
    expect(html.indexOf("Hello")).toBeLessThan(html.indexOf("Kumusta po"));
  });
});
