/**
 * Preset canvas parity — for every shipped theme preset, the value the editor
 * "floats up" into its style controls must be the value the canvas actually
 * paints.
 *
 * The trap this guards (see the `portfolio-effective-defaults` skill): the
 * editor canvas isolates its text color with
 * `[data-puck-preview] { color: var(--foreground) }` — the APP-SHELL foreground —
 * while the published page inherits `var(--pf-color-fg)`, the BRAND foreground.
 * A block that resolves an unset color through CSS `inherit` therefore renders
 * app-shell grey on the canvas and brand ink on the live page, while its control
 * confidently displays the brand value. Blocks avoid this by grounding their own
 * outer element to `var(--pf-color-fg)`.
 *
 * The probe below is mounted on the editor shell (which carries the resolved
 * `--pf-*` vars) rather than inside the Puck preview, so it reads the brand
 * values the controls float. Any block that regressed to `inherit` would read
 * the app-shell foreground instead and fail this comparison.
 *
 * Applies each preset in the Theme panel and never saves or publishes, so the
 * seeded workspace is left untouched.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

// A seeded draft carrying headings and body text on the canvas.
const DRAFT_NAME = "Editorial Summer Refresh";
const PRESETS = ["Minimal", "Editorial", "Luxury", "Bold", "Romantic", "Modern"] as const;

const SHELL = "[data-testid='portfolio-editor-shell']";

type Probe = {
  brandFg: string;
  brandBg: string;
  brandAccent: string;
  headingFont: string;
  bodyFont: string;
  radius: string;
  appFg: string;
};

/**
 * Resolve what the brand vars actually compute to, by mounting a throwaway
 * element on the shell and reading it back. Comparing computed-to-computed
 * avoids asserting against next/font's hashed family names.
 */
async function readBrandProbe(page: Page): Promise<Probe> {
  return page.evaluate((shellSel) => {
    const shell = document.querySelector(shellSel) as HTMLElement;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    shell.appendChild(probe);

    const read = (prop: string, value: string) => {
      probe.style.setProperty(prop, value);
      const computed = getComputedStyle(probe)[prop as "color"] as string;
      probe.style.removeProperty(prop);
      return computed;
    };

    const brandFg = read("color", "var(--pf-color-fg)");
    const brandBg = read("color", "var(--pf-color-bg)");
    const brandAccent = read("color", "var(--pf-color-accent)");
    const headingFont = read("font-family", "var(--pf-font-heading)");
    const bodyFont = read("font-family", "var(--pf-font-body)");
    const appFg = read("color", "var(--foreground)");
    const radius = getComputedStyle(shell).getPropertyValue("--pf-radius").trim();

    probe.remove();
    return { brandFg, brandBg, brandAccent, headingFont, bodyFont, radius, appFg };
  }, SHELL);
}

/**
 * Open the editor's Theme panel. The app's light/dark switcher is also named
 * "Theme"; the editor's panel trigger is the one carrying both aria-label and
 * title.
 */
async function openThemePanel(page: Page): Promise<void> {
  await page.locator('button[aria-label="Theme"][title="Theme"]').first().click();
  await page
    .getByRole("button", { name: "Apply theme: Minimal" })
    .waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Apply a preset from the open panel. The panel stays open for the whole run —
 * closing it after a brand-kit change trips the dirty guard, and the canvas
 * behind it still reports real computed styles.
 */
async function applyPreset(page: Page, name: string): Promise<void> {
  const tile = page.getByRole("button", { name: `Apply theme: ${name}` });
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(tile).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
  await page.waitForTimeout(300);
}

test.describe("theme presets: floated values match the canvas", () => {
  test("every preset paints the brand ink and fonts it floats", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, DRAFT_NAME);

    const canvas = page.locator("[data-puck-preview]").first();
    await canvas.waitFor({ state: "visible", timeout: 30_000 });

    const heading = canvas.locator("h1, h2, h3").first();
    const paragraph = canvas.locator("p").first();
    await heading.waitFor({ state: "visible", timeout: 30_000 });
    await paragraph.waitFor({ state: "visible", timeout: 30_000 });

    await openThemePanel(page);

    for (const preset of PRESETS) {
      await applyPreset(page, preset);
      const probe = await readBrandProbe(page);

      // Sanity: the preset actually took effect on the shell's vars.
      expect(probe.brandFg, `${preset}: brand foreground resolved`).toMatch(/^rgb/);
      expect(["0px", "4px", "8px", "0", "0.25rem", "0.5rem"], `${preset}: radius`).toContain(
        probe.radius
      );

      const headingStyle = await heading.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { color: cs.color, fontFamily: cs.fontFamily };
      });
      const paragraphStyle = await paragraph.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { color: cs.color, fontFamily: cs.fontFamily };
      });

      // The canvas isolates text color to the app-shell foreground; a block that
      // resolved through `inherit` would land there instead of on brand ink.
      expect(headingStyle.color, `${preset}: heading paints brand ink, not canvas inherit`).toBe(
        probe.brandFg
      );
      expect(paragraphStyle.color, `${preset}: text paints brand ink, not canvas inherit`).toBe(
        probe.brandFg
      );

      expect(headingStyle.fontFamily, `${preset}: heading uses the brand heading font`).toBe(
        probe.headingFont
      );
      expect(paragraphStyle.fontFamily, `${preset}: text uses the brand body font`).toBe(
        probe.bodyFont
      );
    }
  });
});
