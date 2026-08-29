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
import { openEditorWithDraft } from "./helpers";

const DRAFT_NAME = "Editorial Summer Refresh";

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
