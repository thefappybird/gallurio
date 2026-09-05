/**
 * Floated block controls, verified against what the canvas actually paints.
 *
 * `preset-canvas-parity.spec.ts` covers the "floated-default drift" bug class
 * for theme-preset colors/fonts. This file covers specific fixes that needed
 * a real browser to confirm: a control that visibly moves nothing on the
 * canvas is a different failure mode than a wrong color, and only a browser
 * can tell the two apart.
 *
 * Read-only except for temporary in-session edits (Content-tab text, control
 * clicks) — nothing is ever saved or published, so the shared seeded
 * workspace is left as found.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { openEditorWithDraft, contrastRatio, readButtonPaint } from "./helpers";

const DRAFT_NAME = "Editorial Summer Refresh";
const PRESETS = ["Minimal", "Editorial", "Luxury", "Bold", "Romantic", "Modern"] as const;

function canvasOf(page: Page): Locator {
  return page.locator("[data-puck-preview]").first();
}

/** Click a block-properties tab (Content / Design / Layout). */
async function clickTab(page: Page, name: "Content" | "Design" | "Layout"): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

/** Expand an EditorDrawerSection accordion by its title, if not already open. */
async function expandSection(page: Page, title: string): Promise<void> {
  const header = page.getByRole("button", { name: title, exact: true });
  if ((await header.getAttribute("aria-expanded")) === "false") {
    await header.click();
  }
}

test.describe("ContactDetails: floated controls actually paint the canvas", () => {
  test("Icon align moves the socials row's justify-content, not just the control", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, DRAFT_NAME);

    const canvas = canvasOf(page);
    const contact = canvas.locator('[data-block="contact-details"]').first();
    await contact.waitFor({ state: "visible", timeout: 30_000 });
    await contact.click();

    // The canvas ContactDetails preview reads its own props directly (not the
    // workspace's real contact data), so it shows a placeholder with no
    // socials row until at least one social field is filled in on the
    // Content tab.
    await clickTab(page, "Content");
    await page.getByLabel("Instagram username").fill("teststudio");

    const socialsRow = contact.locator("dd:has(a)");
    await socialsRow.waitFor({ state: "visible", timeout: 15_000 });

    await clickTab(page, "Design");
    await expandSection(page, "Icons");

    const baseline = await socialsRow.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(baseline, "unset icon align defaults to center").toBe("center");

    const left = page.getByRole("button", { name: "Align icons left" });
    const center = page.getByRole("button", { name: "Align icons center" });
    const right = page.getByRole("button", { name: "Align icons right" });

    await left.click();
    await expect(left, "left toggle reports pressed").toHaveAttribute("aria-pressed", "true");
    const afterLeft = await socialsRow.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(afterLeft, "clicking left actually moves the row").not.toBe(baseline);
    expect(afterLeft, "left resolves to flex-start").toBe("flex-start");

    await right.click();
    await expect(right, "right toggle reports pressed").toHaveAttribute("aria-pressed", "true");
    await expect(left, "left toggle releases").toHaveAttribute("aria-pressed", "false");
    const afterRight = await socialsRow.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(afterRight, "clicking right actually moves the row again").not.toBe(afterLeft);
    expect(afterRight, "right resolves to flex-end").toBe("flex-end");

    await center.click();
    await expect(center, "center toggle reports pressed").toHaveAttribute("aria-pressed", "true");
    const afterCenter = await socialsRow.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(afterCenter, "clicking center moves the row back").not.toBe(afterRight);
    expect(afterCenter, "center resolves to center").toBe("center");
  });

  test("entrance animation and hover effect reach the canvas dl (were inert before the fix)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, DRAFT_NAME);

    const canvas = canvasOf(page);
    const contact = canvas.locator('[data-block="contact-details"]').first();
    await contact.waitFor({ state: "visible", timeout: 30_000 });
    await contact.click();

    await clickTab(page, "Design");
    await expandSection(page, "Effects");

    const before = await contact.evaluate((el) => ({
      anim: el.getAttribute("data-anim"),
      hover: el.getAttribute("data-hover"),
    }));
    expect(before.anim, "no entrance animation set yet").toBeNull();
    expect(before.hover, "no hover effect set yet").toBeNull();

    const effectsHeader = page.getByRole("button", { name: "Effects", exact: true });
    const effectsSection = effectsHeader.locator("xpath=..");
    const selects = effectsSection.locator("select");

    await selects.nth(0).selectOption("fade");
    await expect(contact, "entrance animation reaches the canvas dl").toHaveAttribute(
      "data-anim",
      "fade"
    );

    await selects.nth(1).selectOption("lift");
    await expect(contact, "hover effect reaches the canvas dl").toHaveAttribute("data-hover", "lift");
  });
});

test.describe("Gallery blocks: padding controls float the real render default", () => {
  test("GalleryGrid Spacing > Padding shows placeholder 64 (top) and 24 (right), not blank", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, DRAFT_NAME);

    await page.getByRole("button", { name: "Gallery", exact: true }).click();

    const canvas = canvasOf(page);
    const gallery = canvas.locator('[data-block="gallery-grid"]').first();
    await gallery.waitFor({ state: "visible", timeout: 30_000 });
    await gallery.click();

    await clickTab(page, "Layout");
    await expandSection(page, "Spacing");
    await page.getByRole("button", { name: "Padding advanced options" }).click();

    const spinbuttons = page.getByRole("spinbutton");
    await expect(spinbuttons.first()).toBeVisible({ timeout: 10_000 });
    const placeholders = await spinbuttons.evaluateAll((els) =>
      (els as HTMLInputElement[]).map((el) => el.placeholder)
    );

    // Order is Top, Right, Bottom, Left (DimensionInput rows in PaddingControls).
    expect(placeholders[0], "Top padding placeholder floats the real 4rem default").toBe("64");
    expect(placeholders[1], "Right padding placeholder floats the real 1.5rem default").toBe("24");
  });
});

const SHELL = "[data-testid='portfolio-editor-shell']";

/** Resolve --pf-color-bg / --pf-color-fg the same way preset-canvas-parity does. */
async function readBrandTokens(page: Page): Promise<{ brandBg: string; appFg: string }> {
  return page.evaluate((shellSel) => {
    const shell = document.querySelector(shellSel) as HTMLElement;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    shell.appendChild(probe);
    const read = (value: string) => {
      probe.style.color = value;
      const computed = getComputedStyle(probe).color;
      probe.style.color = "";
      return computed;
    };
    const brandBg = read("var(--pf-color-bg)");
    const appFg = read("var(--foreground)");
    probe.remove();
    return { brandBg, appFg };
  }, SHELL);
}

async function openThemePanel(page: Page): Promise<void> {
  await page.locator('button[aria-label="Theme"][title="Theme"]').first().click();
  await page
    .getByRole("button", { name: "Apply theme: Minimal" })
    .waitFor({ state: "visible", timeout: 15_000 });
}

async function applyPreset(page: Page, name: string): Promise<void> {
  const tile = page.getByRole("button", { name: `Apply theme: ${name}` });
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(tile).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
  await page.waitForTimeout(300);
}

// Puck ships CSS-module class names; match on the stable hashed prefix. The
// drawer's expand state lives on the category root's class (`--isExpanded`),
// not on the clickable title as aria-expanded.
const CATEGORY_TITLE = '[class*="_ComponentList-title_"]';
const CATEGORY_ROOT = '[class*="_ComponentList_"]';

function categoryFor(page: Page, title: string): Locator {
  return page
    .locator(CATEGORY_ROOT)
    .filter({ has: page.locator(CATEGORY_TITLE).filter({ hasText: new RegExp(`^${title}$`, "i") }) })
    .first();
}

async function expandDrawerGroup(page: Page, title: string): Promise<void> {
  const category = categoryFor(page, title);
  await category.waitFor({ state: "visible", timeout: 15_000 });
  if ((await category.getAttribute("class"))?.includes("--isExpanded")) return;
  await category.locator(CATEGORY_TITLE).first().click();
  await page.waitForTimeout(250);
}

/** Puck's dnd-kit ghost-copy drawer item + activation-threshold drag (see the portfolio-testing skill). */
async function dragDrawerItemToCanvas(page: Page, itemName: string): Promise<void> {
  const item = page
    .locator('[class*="_DrawerItem-name_"]')
    .filter({ hasText: new RegExp(`^${itemName}$`) })
    .first();
  await item.scrollIntoViewIfNeeded();
  const source = await item.boundingBox();
  if (!source) throw new Error(`drawer item "${itemName}" has no bounding box`);

  // [data-puck-preview] is sized to its full CONTENT height, not the visible
  // viewport — its scrollable ancestor (`_PuckCanvas-root_`, `overflow: auto`)
  // is what's actually clipped to the screen. Dropping against the preview's
  // own (unclipped) bounding box computes a point far off the real viewport;
  // use the scrollable ancestor's box instead.
  const viewport = page.locator('[class*="_PuckCanvas-root_"]').first();
  const target = await viewport.boundingBox();
  if (!target) throw new Error("canvas viewport has no bounding box");

  const bx = source.x + source.width / 2;
  const by = source.y + source.height / 2;
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height - 40;

  await page.mouse.move(bx, by);
  await page.mouse.down();
  await page.mouse.move(bx + 6, by + 6);
  await page.waitForTimeout(60);
  await page.mouse.move(cx, cy, { steps: 18 });
  await page.mouse.move(cx, cy + 4, { steps: 4 });
  await page.mouse.up();
}

test.describe("FooterStatementPreset: link buttons stay legible on a primary band", () => {
  test("every preset keeps the footer nav links legible (were 1.00:1 before the fix)", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, DRAFT_NAME);

    const canvas = canvasOf(page);
    await canvas.waitFor({ state: "visible", timeout: 30_000 });

    await expandDrawerGroup(page, "Footer");
    await dragDrawerItemToCanvas(page, "Closing statement");

    const statement = canvas.getByText("Let's make something worth keeping.", { exact: true });
    await expect(statement, "dragging the Closing statement preset inserted it into the canvas").toHaveCount(
      1,
      { timeout: 15_000 }
    );
    await statement.scrollIntoViewIfNeeded();

    const homeLink = canvas.locator('a[role="button"]').filter({ hasText: /^Home$/ });
    const galleryLink = canvas.locator('a[role="button"]').filter({ hasText: /^Gallery$/ });
    await homeLink.waitFor({ state: "visible", timeout: 15_000 });
    await galleryLink.waitFor({ state: "visible", timeout: 15_000 });

    await openThemePanel(page);

    for (const preset of PRESETS) {
      await applyPreset(page, preset);
      const { brandBg, appFg } = await readBrandTokens(page);

      for (const [label, link] of [
        ["Home", homeLink],
        ["Gallery", galleryLink],
      ] as const) {
        const paint = await readButtonPaint(link);
        expect(paint.color, `${preset}: ${label} link is not the app-shell foreground`).not.toBe(
          appFg
        );
        expect(paint.color, `${preset}: ${label} link paints brand background on its primary band`).toBe(
          brandBg
        );
        const contrast = contrastRatio(paint.labelRgb, paint.effectiveRgb);
        expect(
          contrast,
          `${preset}: ${label} link legible on its band (${contrast.toFixed(2)}:1)`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
