import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Contract test for the app-shell design tokens. These lock the styling
// decisions that aren't expressible as component behaviour: softened contrast
// (no pure black/white poles), the friendly app font, and the radius theming
// seam. Exact oklch values are tuned visually, so we assert intent (ranges /
// structure / references), not pixel-precise values.
const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

// Slice each palette by its own braces (the blocks have no nested braces), so
// stray mentions of `.dark` / `html[data-radius` inside comments don't shift the
// boundaries. The first `:root {` is the light palette; the first `.dark {` (not
// the `.dark *` custom-variant) is the dark palette.
function block(opener: string): string {
  const start = css.indexOf(opener);
  return css.slice(start, css.indexOf("}", start) + 1);
}
const lightRoot = block(":root {");
const darkRoot = block(".dark {");

function lightness(token: string, scope: string): number {
  const m = scope.match(new RegExp(`${token}:\\s*oklch\\(([0-9.]+)`));
  if (!m) throw new Error(`token ${token} not found / not oklch in scope`);
  return Number(m[1]);
}

describe("app-shell design tokens", () => {
  it("softens both poles, uses the app font, and exposes the radius seam", () => {
    // App-shell font is the friendly sans, not Merriweather.
    expect(css).toMatch(/--font-sans:\s*var\(--font-jakarta\)/);

    // Light base is a dirty off-white, never pure white; its text is a
    // lighter-than-black charcoal, never near-pure-black.
    expect(lightRoot).not.toMatch(/--background:\s*oklch\(1 /);
    expect(lightness("--background", lightRoot)).toBeGreaterThan(0.95);
    expect(lightness("--background", lightRoot)).toBeLessThan(1);
    expect(lightness("--foreground", lightRoot)).toBeGreaterThan(0.2);

    // Dark base is a lighter black, never the old near-pure-black 0.145; its
    // text is off-white, never pure white.
    expect(darkRoot).not.toMatch(/--background:\s*oklch\(0\.145 /);
    expect(lightness("--background", darkRoot)).toBeGreaterThan(0.18);
    expect(lightness("--foreground", darkRoot)).toBeLessThan(0.97);

    // Focus ring is brand-tinted (teal hue 195) in both schemes.
    expect(lightRoot).toMatch(/--ring:\s*oklch\([0-9.]+ [0-9.]+ 195\)/);

    // Radius theming seam: a structural-frame token plus the three presets the
    // appTheme config emits.
    expect(css).toMatch(/--radius-surface:/);
    expect(css).toMatch(/html\[data-radius="sharp"\]/);
    expect(css).toMatch(/html\[data-radius="subtle"\]/);
    expect(css).toMatch(/html\[data-radius="rounded"\]/);
  });
});
