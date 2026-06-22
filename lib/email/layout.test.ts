import { describe, it, expect } from "vitest";
import { renderBrandedEmail } from "./layout";
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
