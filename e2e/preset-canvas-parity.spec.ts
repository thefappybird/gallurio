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
import { openEditorWithDraft, contrastRatio, readButtonPaint } from "./helpers";

// A seeded draft carrying headings and body text on the canvas.
const DRAFT_NAME = "Editorial Summer Refresh";
const PRESETS = ["Minimal", "Editorial", "Luxury", "Bold", "Romantic", "Modern"] as const;

const SHELL = "[data-testid='portfolio-editor-shell']";

type Probe = {
  brandFg: string;
  brandBg: string;
  brandAccent: string;
  brandPrimary: string;
  brandSecondary: string;
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
    const brandPrimary = read("color", "var(--pf-color-primary)");
    const brandSecondary = read("color", "var(--pf-color-secondary)");
    const headingFont = read("font-family", "var(--pf-font-heading)");
    const bodyFont = read("font-family", "var(--pf-font-body)");
    const appFg = read("color", "var(--foreground)");
    const radius = getComputedStyle(shell).getPropertyValue("--pf-radius").trim();

    probe.remove();
    return {
      brandFg,
      brandBg,
      brandAccent,
      brandPrimary,
      brandSecondary,
      headingFont,
      bodyFont,
      radius,
      appFg,
    };
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

  /**
   * The heading/paragraph test above never touches a Button — exactly what the
   * reported bug was about. Two buttons on the Home zone cover two of the
   * families a button can resolve through:
   *  - a "soft" button (colorVar defaults to brand primary) on a secondary band,
   *  - a no-`_style` "legacy" button that cascades to the section text token
   *    (unset here, so it falls all the way to brand foreground).
   * (The third family — an outline button pinned onto a primary band — lives
   * on the Gallery zone and is covered by its own test below: the Theme panel
   * is a modal dialog, and its backdrop blocks clicks on the zone switcher
   * behind it, so a zone change can't happen while it's open.)
   * For each, across all 6 presets: the label/border must equal the exact
   * brand token they are supposed to resolve to (not the app-shell
   * foreground), and the label must stay legible against what the button
   * actually paints behind it.
   */
  test("every preset paints legible, brand-toned buttons — not the editor's app-shell foreground", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, DRAFT_NAME);

    const canvas = page.locator("[data-puck-preview]").first();
    await canvas.waitFor({ state: "visible", timeout: 30_000 });

    // Puck's dnd-kit overlay wraps every component in its own
    // `role="button"` draggable handle sharing the component's accessible
    // name, so `getByRole("button", ...)` matches 3 elements per label. The
    // real rendered control is the ButtonBlock's own `<a role="button">` —
    // scope to the anchor tag specifically.
    const buttonByLabel = (label: string) =>
      canvas.locator('a[role="button"]').filter({ hasText: new RegExp(`^${label}$`) });
    const softButton = buttonByLabel("Get in Touch");
    const legacyButton = buttonByLabel("Send a Message");
    await softButton.waitFor({ state: "visible", timeout: 30_000 });
    await legacyButton.waitFor({ state: "visible", timeout: 30_000 });

    await openThemePanel(page);

    for (const preset of PRESETS) {
      await applyPreset(page, preset);
      const probe = await readBrandProbe(page);

      // --- Soft button (Home zone): label is brand primary, fill is a
      // visible tint, both legible.
      const soft = await readButtonPaint(softButton);
      expect(soft.color, `${preset}: soft button label is brand primary`).toBe(probe.brandPrimary);
      expect(soft.color, `${preset}: soft button label is not the app-shell foreground`).not.toBe(
        probe.appFg
      );
      expect(
        soft.ownBgAlpha,
        `${preset}: soft button paints a tinted fill, not fully transparent`
      ).toBeGreaterThan(0.01);
      // A tinted (partial-alpha) fill is still checked at the 4.5:1 text bar —
      // only a fully opaque solid fill drops to the 3:1 non-text-component bar.
      const softLabelContrast = contrastRatio(soft.labelRgb, soft.effectiveRgb);
      expect(
        softLabelContrast,
        `${preset}: soft button label legible on its own fill (${softLabelContrast.toFixed(2)}:1)`
      ).toBeGreaterThanOrEqual(4.5);

      // --- Legacy button (Home zone, no _style): cascades to brand
      // foreground for both label and border, paints no fill.
      const legacy = await readButtonPaint(legacyButton);
      expect(legacy.color, `${preset}: legacy button label is brand foreground`).toBe(probe.brandFg);
      expect(
        legacy.borderBottomColor,
        `${preset}: legacy button border is brand foreground`
      ).toBe(probe.brandFg);
      expect(legacy.ownBgAlpha, `${preset}: legacy button paints no fill`).toBeLessThan(0.01);
      const legacyContrast = contrastRatio(legacy.labelRgb, legacy.effectiveRgb);
      expect(
        legacyContrast,
        `${preset}: legacy button label legible (${legacyContrast.toFixed(2)}:1)`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * A third button on the Gallery zone, sitting on an accent-colored band.
   * Switches zone BEFORE opening the Theme panel — the panel is a modal
   * dialog, and once open its backdrop blocks clicks on the zone switcher
   * behind it (confirmed: switching zones mid-loop hangs the test).
   *
   * This seeded draft's button turned out (verified live, not by reading the
   * template source) to be a SOLID fill whose exact token pairing predates
   * the onPrimaryBand/onAccentBand recipes — the live seed has drifted from
   * what the current template source would generate. Rather than hardcode a
   * guess at which of the 5 brand tokens its label resolves to, the first
   * preset iteration discovers it empirically, then every later preset must
   * land on that SAME token. That still catches every real regression this
   * file guards against (falling to the app-shell foreground, `inherit`, or
   * a different token on some presets but not others) without asserting a
   * value nothing here can independently confirm.
   */
  test("every preset paints a legible button on the Gallery zone's accent band", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, DRAFT_NAME);

    await page.getByRole("button", { name: "Gallery", exact: true }).click();

    const canvas = page.locator("[data-puck-preview]").first();
    await canvas.waitFor({ state: "visible", timeout: 30_000 });
    const galleryButton = canvas
      .locator('a[role="button"]')
      .filter({ hasText: /^Get in Touch$/ });
    await galleryButton.waitFor({ state: "visible", timeout: 30_000 });

    await openThemePanel(page);

    let expectedTokenKey: keyof Probe | null = null;
    const TOKEN_KEYS = ["brandFg", "brandBg", "brandPrimary", "brandSecondary", "brandAccent"] as const;

    for (const preset of PRESETS) {
      await applyPreset(page, preset);
      const probe = await readBrandProbe(page);

      const paint = await readButtonPaint(galleryButton);
      expect(
        paint.color,
        `${preset}: gallery button label is not the app-shell foreground`
      ).not.toBe(probe.appFg);

      if (expectedTokenKey === null) {
        const match = TOKEN_KEYS.find((k) => probe[k] === paint.color);
        expect(match, `${preset}: gallery button label resolves to a real brand token`).toBeDefined();
        expectedTokenKey = match!;
      } else {
        expect(
          paint.color,
          `${preset}: gallery button label stays on the same brand token (${expectedTokenKey}) as ${PRESETS[0]}`
        ).toBe(probe[expectedTokenKey]);
      }

      // A fully opaque fill only needs the 3:1 non-text-component bar; a
      // transparent/tinted one is read against its band at the 4.5:1 text bar.
      const minContrast = paint.ownBgAlpha > 0.99 ? 3 : 4.5;
      const contrast = contrastRatio(paint.labelRgb, paint.effectiveRgb);
      expect(
        contrast,
        `${preset}: gallery button legible on its actual backdrop (${contrast.toFixed(2)}:1, needs ${minContrast}:1)`
      ).toBeGreaterThanOrEqual(minContrast);
    }
  });
});
