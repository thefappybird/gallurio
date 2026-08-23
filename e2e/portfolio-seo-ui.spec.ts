import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Verifies browser-observed behavior (not just compile-time correctness) for
// three surfaces shipped on this branch without Playwright evidence:
//  1. ImageMetaDialog (alt-text editor) — reached via MediaPicker (Puck field
//     panel) and via EditCollectionDialog (Photos manager). Both entry points
//     render localized copy: Puck portals its field panel, so next-intl context
//     reaches it.
//  2. Every overlay control on both tile types — grip, checkbox, Cover and
//     pencil are all 24x24 CSS px minimum (WCAG 2.2 SC 2.5.8).
//  3. The settings public-page SEO auto-hints.

const LOCALES = ["en", "fil", "id", "ar", "th"] as const;
type Locale = (typeof LOCALES)[number];
const RTL: ReadonlySet<Locale> = new Set(["ar"]);

const MESSAGES: Record<Locale, unknown> = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    JSON.parse(fs.readFileSync(path.resolve(__dirname, `../messages/${l}.json`), "utf8")),
  ]),
) as Record<Locale, unknown>;

function pick(locale: Locale, dotted: string): string {
  const val = dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, MESSAGES[locale]);
  if (typeof val !== "string") throw new Error(`Missing message ${locale}:${dotted}`);
  return val;
}

function tpl(locale: Locale, dotted: string, vars: Record<string, string>): string {
  let s = pick(locale, dotted);
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

function localePath(locale: Locale, p: string): string {
  return locale === "en" ? p : `/${locale}${p}`;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function gotoPortfolio(page: Page, locale: Locale): Promise<void> {
  await page.goto(localePath(locale, "/portfolio"));
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1_200);

  const resumeLabel = pick(locale, "app.pageBuilder.editor.entryDialog.resumeTitle");
  const cont = page.getByRole("button", { name: resumeLabel });
  if (await cont.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await cont.click();
    await page.waitForTimeout(600);
  }
  // First-visit spotlight guide would otherwise intercept clicks.
  const skipGuide = page.getByRole("button", { name: /Skip Guide/i });
  if (await skipGuide.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipGuide.click();
    const confirm = page.getByRole("button", { name: /Skip Guide/i });
    if (await confirm.isVisible({ timeout: 1_000 }).catch(() => false)) await confirm.click();
    await page.waitForTimeout(400);
  }
}

/** Opens Photos manager -> "Weddings" collection -> pencil on the first tile ("Weddings sample 1"). Localized copy. */
async function openEditCollectionImageMeta(page: Page, locale: Locale) {
  await gotoPortfolio(page, locale);
  await page.locator('[data-tour-id="photos"]').click();
  await page.waitForTimeout(700);

  const editLabel = tpl(locale, "app.pageBuilder.editor.photosDialog.editAria", { name: "Weddings" });
  await page.getByRole("button", { name: editLabel }).click();
  await page.waitForTimeout(900);

  const pencilLabel = tpl(locale, "app.pageBuilder.editor.imageMeta.editTrigger", {
    name: "Weddings sample 1",
  });
  const trigger = page.getByRole("button", { name: pencilLabel }).first();
  await trigger.click();
  await page.waitForTimeout(400);

  const title = pick(locale, "app.pageBuilder.editor.imageMeta.title");
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return { dialog, trigger };
}

/** Adds a Gallery Grid preset to the canvas, opens its MediaPicker, navigates into "All photos". */
async function openMediaPickerAllPhotos(page: Page, locale: Locale = "en") {
  await gotoPortfolio(page, locale);

  // The block-library panel is localized, so the draggable item's visible
  // label follows the chrome locale.
  const galleryGridLabel = pick(locale, "app.pageBuilder.editor.puckConfig.blocks.galleryGridPreset");
  const galleryGridItem = page.getByText(galleryGridLabel, { exact: true }).first();
  const canvas = page.locator("[data-puck-preview]").first();
  const placeholder = page.getByText("No photos in this collection yet.");

  // The dnd-kit pointer-sensor drag is occasionally missed by the synthetic
  // mouse sequence (activation threshold not registered in time) — retry
  // once rather than flake the whole surface on a drag-simulation miss.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const box = await galleryGridItem.boundingBox();
    const canvasBox = await canvas.boundingBox();
    if (!box || !canvasBox) throw new Error("could not locate Gallery Grid component / canvas");
    const bx = box.x + box.width / 2;
    const by = box.y + box.height / 2;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + 50;
    await page.mouse.move(bx, by);
    await page.mouse.down();
    await page.mouse.move(bx + 6, by + 6);
    await page.waitForTimeout(80);
    await page.mouse.move((bx + cx) / 2, (by + cy) / 2, { steps: 10 });
    await page.mouse.move(cx, cy, { steps: 18 });
    await page.mouse.move(cx, cy + 4, { steps: 4 });
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(900);

    if (await placeholder.isVisible({ timeout: attempt === 1 ? 8_000 : 15_000 }).catch(() => false)) break;
    if (attempt === 2) throw new Error("Gallery Grid block did not land on the canvas after 2 drag attempts");
  }

  await placeholder.click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Choose photos" }).click();
  await page.waitForTimeout(700);
  const allPhotos = page.getByRole("button", { name: "All photos" });
  await allPhotos.click();
  await page.waitForTimeout(900);

  const dialog = page.getByRole("dialog", { name: "All photos" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    window.localStorage.setItem("theme", t);
  }, theme);
}

/** Relative luminance contrast helper — parses rgb()/rgba() computed colors. */
function luminance(color: string): number | null {
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const rgbFn = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  const parts = hex
    ? [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)]
    : rgbFn
      ? [Number(rgbFn[1]), Number(rgbFn[2]), Number(rgbFn[3])]
      : null;
  if (!parts) return null;
  const [r, g, b] = parts.map((c) => {
    const v = Number(c) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number | null {
  const lf = luminance(fg);
  const lb = luminance(bg);
  if (lf == null || lb == null) return null;
  const lighter = Math.max(lf, lb);
  const darker = Math.min(lf, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ===========================================================================
// 1. Layout / responsive — no horizontal overflow at 375/768/1280
// ===========================================================================

test.describe("Layout / responsive — no horizontal overflow", () => {
  for (const width of [375, 768, 1280]) {
    test(`EditCollectionDialog + ImageMetaDialog @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openEditCollectionImageMeta(page, "en");
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth, `scrollWidth vs clientWidth @ ${width}`).toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );
    });

    test(`MediaPicker + ImageMetaDialog @ ${width}px`, async ({ page }) => {
      // The Components panel that supplies the draggable Gallery Grid block is not
      // reachable at <lg widths (the editor is a desktop-only surface for adding
      // blocks) — build the fixture at desktop size, then resize down to the
      // width under test so the already-open dialog reflows for real.
      await page.setViewportSize({ width: 1280, height: 900 });
      const dialog = await openMediaPickerAllPhotos(page);
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      await dialog.locator('button[aria-label^="Edit alt text for"]').first().click();
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth, `scrollWidth vs clientWidth @ ${width}`).toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );
    });

    test(`Settings SEO hints @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings/public-page");
      await page.locator("#seoTitle").waitFor({ state: "visible", timeout: 15_000 });
      await page.locator("#seoTitle").fill("");
      await page.locator("#seoDescription").fill("");
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth, `scrollWidth vs clientWidth @ ${width}`).toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );
    });
  }
});

// ===========================================================================
// 2. 375px tile control geometry — measured, not eyeballed
// ===========================================================================

test.describe("375px tile overlay controls", () => {
  test("EditCollectionDialog tile: grip / checkbox / cover / pencil do not overlap and stay inside the tile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openEditCollectionImageMeta(page, "en");
    // Close the ImageMetaDialog opened by the helper — we need the tile underneath.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const tile = page
      .locator("li")
      .filter({ has: page.locator('button[aria-label^="Set "]') })
      .first();
    const tileBox = await tile.boundingBox();
    const grip = tile.locator("span.cursor-grab").first();
    const gripBox = await grip.boundingBox();
    const checkboxLabel = tile.locator("label").first();
    const checkboxBox = await checkboxLabel.boundingBox();
    const coverBtn = tile.locator('button[aria-label^="Set "]').first();
    const coverBox = await coverBtn.boundingBox();
    const pencilBtn = tile.locator('button[aria-label^="Edit alt text for"]').first();
    const pencilBox = await pencilBtn.boundingBox();

    expect(tileBox, "tile bounding box").not.toBeNull();
    expect(gripBox, "grip bounding box").not.toBeNull();
    expect(checkboxBox, "checkbox bounding box").not.toBeNull();
    expect(coverBox, "cover bounding box").not.toBeNull();
    expect(pencilBox, "pencil bounding box").not.toBeNull();

    const boxes = {
      grip: gripBox!,
      checkbox: checkboxBox!,
      cover: coverBox!,
      pencil: pencilBox!,
    };

    function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
      return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    const entries = Object.entries(boxes);
    const overlaps: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [nameA, boxA] = entries[i];
        const [nameB, boxB] = entries[j];
        if (intersects(boxA, boxB)) overlaps.push(`${nameA} x ${nameB}`);
      }
    }
    console.log("[tile-geometry] tile", JSON.stringify(tileBox), "controls", JSON.stringify(boxes));
    expect(overlaps, `overlapping control pairs: ${overlaps.join(", ")}`).toEqual([]);

    // All four controls stay within the tile bounds (no spill-out).
    for (const [name, b] of entries) {
      expect(b.x, `${name} left edge inside tile`).toBeGreaterThanOrEqual(tileBox!.x - 1);
      expect(b.x + b.width, `${name} right edge inside tile`).toBeLessThanOrEqual(tileBox!.x + tileBox!.width + 1);
      expect(b.y, `${name} top edge inside tile`).toBeGreaterThanOrEqual(tileBox!.y - 1);
      expect(b.y + b.height, `${name} bottom edge inside tile`).toBeLessThanOrEqual(tileBox!.y + tileBox!.height + 1);
    }

    // WCAG 2.2 SC 2.5.8 — 24x24 CSS px minimum on every overlay control, not
    // just the pencil. The grip is aria-hidden (the whole <li> is the drag
    // target) but is sized to match so the four corners read as one control set.
    for (const [name, b] of entries) {
      expect(b.width, `${name} target width`).toBeGreaterThanOrEqual(24);
      expect(b.height, `${name} target height`).toBeGreaterThanOrEqual(24);
    }
  });

  test("pencil hit target is >=24x24 CSS px on both tile types", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await openEditCollectionImageMeta(page, "en");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const editCollectionPencil = page.locator('button[aria-label^="Edit alt text for"]').first();
    const b1 = await editCollectionPencil.boundingBox();
    expect(b1, "EditCollectionDialog pencil box").not.toBeNull();
    expect(b1!.width, "EditCollectionDialog pencil width").toBeGreaterThanOrEqual(24);
    expect(b1!.height, "EditCollectionDialog pencil height").toBeGreaterThanOrEqual(24);

    // Same desktop-build-then-shrink technique as above — the block library
    // panel needed to add a Gallery Grid block is not reachable at 375px.
    await page.setViewportSize({ width: 1280, height: 900 });
    const dialog2 = await openMediaPickerAllPhotos(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    const mediaPickerPencil = dialog2.locator('button[aria-label^="Edit alt text for"]').first();
    const b2 = await mediaPickerPencil.boundingBox();
    expect(b2, "MediaPicker pencil box").not.toBeNull();
    expect(b2!.width, "MediaPicker pencil width").toBeGreaterThanOrEqual(24);
    expect(b2!.height, "MediaPicker pencil height").toBeGreaterThanOrEqual(24);
  });
});

// ===========================================================================
// 3. Locale x theme — EditCollectionDialog / ImageMetaDialog (localized copy)
// ===========================================================================

test.describe("Locale x theme — EditCollectionDialog ImageMetaDialog", () => {
  for (const locale of LOCALES) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} ${theme}: renders correct script, no mojibake, readable contrast`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width: 375, height: 812 });
        const { dialog } = await openEditCollectionImageMeta(page, locale);

        await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^((?!dark).)*$/);

        const expectedTitle = pick(locale, "app.pageBuilder.editor.imageMeta.title");
        const expectedAltLabel = pick(locale, "app.pageBuilder.editor.imageMeta.altLabel");
        const expectedAltHelp = pick(locale, "app.pageBuilder.editor.imageMeta.altHelp");
        const expectedSave = pick(locale, "app.pageBuilder.editor.imageMeta.save");
        const expectedCancel = pick(locale, "app.pageBuilder.editor.imageMeta.cancel");

        await expect(dialog.getByText(expectedTitle, { exact: true })).toBeVisible();
        await expect(dialog.getByText(expectedAltLabel, { exact: true })).toBeVisible();
        await expect(dialog.getByText(expectedAltHelp, { exact: true })).toBeVisible();
        await expect(dialog.getByRole("button", { name: expectedSave })).toBeVisible();
        await expect(dialog.getByRole("button", { name: expectedCancel })).toBeVisible();

        // Geometry stays inside the viewport for every script, RTL included.
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox, "dialog bounding box").not.toBeNull();
        expect(dialogBox!.x, "dialog does not clip off the left edge").toBeGreaterThanOrEqual(-1);
        expect(dialogBox!.x + dialogBox!.width, "dialog does not clip off the right edge").toBeLessThanOrEqual(376);

        if (RTL.has(locale)) {
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          // The footer stacks buttons vertically below `sm` (flex-col-reverse,
          // unaffected by writing direction) — widen past `sm` to observe the
          // row-direction mirror the RTL rule actually targets, then verify
          // Cancel (first in DOM) renders to the RIGHT of Save.
          await page.setViewportSize({ width: 700, height: 812 });
          await page.waitForTimeout(200);
          const cancelBox = await dialog.getByRole("button", { name: expectedCancel }).boundingBox();
          const saveBox = await dialog.getByRole("button", { name: expectedSave }).boundingBox();
          expect(cancelBox!.x, "Cancel renders to the right of Save in RTL").toBeGreaterThan(saveBox!.x);
          await page.setViewportSize({ width: 375, height: 812 });
          await page.waitForTimeout(200);
        }

        // Dark-theme contrast: measure the hint/body text against its real
        // background rather than assuming the token resolved.
        const altHelpEl = dialog.getByText(expectedAltHelp, { exact: true });
        const [fg, bg] = await altHelpEl.evaluate((el) => {
          const color = getComputedStyle(el).color;
          let node: HTMLElement | null = el as HTMLElement;
          let background = "rgba(0,0,0,0)";
          while (node) {
            const bgc = getComputedStyle(node).backgroundColor;
            if (bgc && bgc !== "rgba(0, 0, 0, 0)" && bgc !== "transparent") {
              background = bgc;
              break;
            }
            node = node.parentElement;
          }
          // Chromium reports computed color in whatever color space the
          // declaring token used (oklch/lab tokens -> lab()/oklab() strings,
          // which our rgb()-only parser can't read) — normalize through a
          // canvas 2D context, which always serializes back to sRGB rgb()/rgba().
          function toRgb(c: string): string {
            // fillStyle serialization can preserve wide-gamut color functions
            // (lab()/oklab()) verbatim in modern Chromium, so read back actual
            // rasterized 8-bit sRGB pixel data instead of trusting the getter.
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = c;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            return `rgb(${r}, ${g}, ${b})`;
          }
          return [toRgb(color), toRgb(background)];
        });
        const ratio = contrastRatio(fg, bg);
        console.log(`[contrast] ${locale} ${theme} altHelp fg=${fg} bg=${bg} ratio=${ratio}`);
        expect(fg, "hint text color differs from resolved background").not.toBe(bg);
        if (ratio != null) {
          expect(ratio, `contrast ratio for altHelp text in ${theme}`).toBeGreaterThanOrEqual(4.5);
        }

        if ((locale === "ar" || locale === "th") && theme === "dark") {
          await page.screenshot({
            path: `e2e/__screenshots__/imagemeta-editcollection-375-${locale}-dark.png`,
          });
        }
      });
    }
  }
});

test("ar: the collection dialog title is bidi-isolated so its quotes cannot reorder", async ({
  page,
}) => {
  await gotoPortfolio(page, "ar");
  await page.locator('[data-tour-id="photos"]').click();
  await page.waitForTimeout(700);

  const editLabel = tpl("ar", "app.pageBuilder.editor.photosDialog.editAria", { name: "Weddings" });
  await page.getByRole("button", { name: editLabel }).click();
  await page.waitForTimeout(900);

  // The title is still English chrome inside an RTL document. Without an
  // explicit isolate the neutral quotes attach to the wrong side and it renders
  // as `"Weddings" Edit`. The DOM text is identical either way, so assert on the
  // isolate itself rather than on the string.
  const isolate = page.locator('[role="dialog"] span[dir="ltr"]').first();
  await expect(isolate).toHaveText('Edit "Weddings"');
  expect(await isolate.evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  await expect(isolate.locator("bdi")).toHaveText("Weddings");

  // The dialog around it stays RTL — the isolate must not flip the whole header.
  const dialogDir = await page
    .locator('[role="dialog"]')
    .first()
    .evaluate((el) => getComputedStyle(el).direction);
  expect(dialogDir).toBe("rtl");
});

// ===========================================================================
// 4. MediaPicker path is localized too
// ===========================================================================
// Puck renders its field panel through createPortal and never mounts a second
// React root, so NextIntlClientProvider context does reach MediaPicker. The
// alt-text dialog used to be handed a hardcoded English label object there,
// which made the same dialog English from a Puck images field and translated
// from the Photos manager. These tests pin the fix.

test.describe("MediaPicker ImageMetaDialog — localized chrome", () => {
  for (const locale of ["ar", "th"] as const) {
    test(`${locale}: MediaPicker + ImageMetaDialog render translated copy`, async ({ page }) => {
      // Block library panel is desktop-only — build at 1280, then shrink to 375
      // to check the already-open dialog's mobile reflow.
      await page.setViewportSize({ width: 1280, height: 900 });
      const dialog = await openMediaPickerAllPhotos(page, locale);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(300);

      // The pencil's aria-label is `editTrigger` with the photo name appended,
      // so match on the localized prefix rather than the whole string.
      const pencilPrefix = pick(locale, "app.pageBuilder.editor.imageMeta.editTrigger")
        .split("{name}")[0]
        .trim();
      await dialog.locator(`button[aria-label^="${pencilPrefix}"]`).first().click();
      await page.waitForTimeout(400);

      const metaDialog = page.getByRole("dialog", {
        name: pick(locale, "app.pageBuilder.editor.imageMeta.title"),
      });
      await expect(metaDialog).toBeVisible();
      await expect(
        metaDialog.getByText(pick(locale, "app.pageBuilder.editor.imageMeta.altLabel"), { exact: true }),
      ).toBeVisible();
      await expect(
        metaDialog.getByRole("button", { name: pick(locale, "app.pageBuilder.editor.imageMeta.save") }),
      ).toBeVisible();

      // The English fallback copy must be gone — that regression is the point.
      await expect(metaDialog.getByText("Alt text", { exact: true })).toHaveCount(0);
      await expect(metaDialog.getByRole("button", { name: "Save" })).toHaveCount(0);

      await page.screenshot({
        path: `e2e/__screenshots__/imagemeta-mediapicker-375-${locale}.png`,
      });
    });
  }
});

// ===========================================================================
// 5. ImageMetaDialog states
// ===========================================================================

test.describe("ImageMetaDialog states", () => {
  test("populated: prefills existing alt text and counts characters", async ({ page }) => {
    const { dialog } = await openEditCollectionImageMeta(page, "en");
    const textarea = dialog.locator("textarea");
    await expect(textarea).toHaveValue("Weddings sample 1");
    await expect(dialog.getByText("17/300 characters")).toBeVisible();
    await expect(textarea).toBeFocused();
  });

  test("empty: null altText renders a blank field, not the string 'null'", async ({ page }) => {
    await page.route("**/api/portfolio/gallery/collections/all**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "fixture-empty-alt",
              publicId: "fixture-empty-alt",
              thumbUrl: "https://picsum.photos/seed/fixture/200/200",
              caption: "Fixture photo",
              altText: null,
            },
          ],
          nextCursor: null,
        }),
      });
    });
    const dialog = await openMediaPickerAllPhotos(page);
    await dialog.locator('button[aria-label^="Edit alt text for"]').first().click();
    await page.waitForTimeout(400);
    const metaDialog = page.getByRole("dialog", { name: "Edit alt text" });
    const textarea = metaDialog.locator("textarea");
    await expect(textarea).toHaveValue("");
    await expect(textarea).not.toHaveValue("null");
    await expect(metaDialog.getByText("0/300 characters")).toBeVisible();
  });

  test("saving: Save disabled with progress, Cancel disabled, dialog cannot be dismissed", async ({ page }) => {
    const { dialog } = await openEditCollectionImageMeta(page, "en");
    let resolveRoute: () => void = () => {};
    const gate = new Promise<void>((r) => (resolveRoute = r));
    await page.route("**/api/portfolio/gallery/items/**", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await gate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "item",
          publicId: "item",
          thumbUrl: "https://picsum.photos/seed/item/200/200",
          caption: "Weddings sample 1",
          altText: "Updated alt text",
        }),
      });
    });

    const saveBtn = dialog.getByRole("button", { name: /Save|Saving/ });
    await saveBtn.click();
    await page.waitForTimeout(200);
    await expect(dialog.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();

    // Escape while saving must not close the dialog (guarded by `if (!saving)`).
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await expect(dialog).toBeVisible();

    resolveRoute();
    await page.waitForTimeout(500);
    await expect(dialog).toBeHidden();
  });

  test("error: 403 owner_only is surfaced without closing the dialog", async ({ page }) => {
    const { dialog, trigger } = await openEditCollectionImageMeta(page, "en");
    await page.route("**/api/portfolio/gallery/items/**", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "owner_only" }),
      });
    });

    await dialog.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(400);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("Only the workspace owner can do this.");
    await expect(dialog.locator("textarea")).toHaveAttribute("aria-invalid", "true");
    void trigger;
  });

  test("success: PATCH 200 shows a toast and closes the dialog, focus returns to the trigger", async ({ page }) => {
    const { dialog, trigger } = await openEditCollectionImageMeta(page, "en");
    await page.route("**/api/portfolio/gallery/items/**", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "item",
          publicId: "item",
          thumbUrl: "https://picsum.photos/seed/item/200/200",
          caption: "Weddings sample 1",
          altText: "Weddings sample 1",
        }),
      });
    });

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Alt text saved.")).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("character counter becomes a polite live region near the limit", async ({ page }) => {
    const { dialog } = await openEditCollectionImageMeta(page, "en");
    const textarea = dialog.locator("textarea");
    const counter = dialog.locator("span[aria-live]").filter({ hasText: "characters" });

    // Far from the limit: no aria-live wrapper (announcing every keystroke drowns the dialog).
    await expect(counter).toHaveCount(0);

    const near = "x".repeat(285);
    await textarea.fill(near);
    await expect(dialog.getByText(`${near.length}/300 characters`)).toBeVisible();
    const liveCounter = dialog.locator('span[aria-live="polite"]').filter({ hasText: "characters" });
    await expect(liveCounter).toHaveCount(1);
  });

  test("keyboard: focus enters the field on open and returns to the trigger on Escape", async ({ page }) => {
    const { dialog, trigger } = await openEditCollectionImageMeta(page, "en");
    await expect(dialog.locator("textarea")).toBeFocused();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // `components/ui/button.tsx` carries `active:not-aria-[haspopup]:translate-y-px`.
  // Tailwind v4 compiles every `translate-*` utility to the standalone `translate`
  // CSS property (`translate: var(--tw-translate-x) var(--tw-translate-y)`), NOT to
  // `transform` — so `getComputedStyle(el).transform` reads `none` even while the
  // pressed state is working. An earlier revision of this test read `transform` and
  // on that basis reported an app-wide button bug that does not exist. Read
  // `translate`, and only `translate`, for any v4 `translate-*` utility.
  test("controls: idle / hover / focus-visible / active / disabled are visually distinct", async ({ page }) => {
    const { dialog } = await openEditCollectionImageMeta(page, "en");
    const cancelBtn = dialog.getByRole("button", { name: "Cancel" });

    const idle = await cancelBtn.evaluate((el) => getComputedStyle(el).backgroundColor);

    await cancelBtn.hover();
    await page.waitForTimeout(100);
    const hovered = await cancelBtn.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Real keyboard Tab (not .focus()) — Chromium's :focus-visible heuristic
    // does not reliably match a bare programmatic focus() call, only
    // keyboard-driven focus, so we drive it the same way a real user would.
    // Tab order from the auto-focused textarea is: textarea -> Cancel -> Save.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);
    await expect(cancelBtn).toBeFocused();
    const focusRing = await cancelBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { boxShadow: cs.boxShadow, borderColor: cs.borderColor };
    });

    await cancelBtn.hover();
    await page.mouse.down();
    await page.waitForTimeout(80);
    const activeTranslate = await cancelBtn.evaluate((el) => getComputedStyle(el).translate);
    await page.mouse.up();

    console.log("[controls]", JSON.stringify({ idle, hovered, focusRing, activeTranslate }));

    expect(hovered, "hover background differs from idle").not.toBe(idle);
    expect(focusRing.boxShadow, "focus-visible ring is present").not.toBe("none");
    expect(activeTranslate, "active state applies a translate").not.toBe("none");

    // Disabled: covered by the "saving" state test (Save + Cancel both `disabled` while pending).
  });
});

// ===========================================================================
// 6. Settings SEO auto-hints
// ===========================================================================

test.describe("Settings SEO hints", () => {
  test("blank title/description shows the auto hint with the previewed sentence; typing hides it live", async ({
    page,
  }) => {
    await page.goto("/settings/public-page");
    const seoTitle = page.locator("#seoTitle");
    const seoDescription = page.locator("#seoDescription");
    await seoTitle.waitFor({ state: "visible", timeout: 15_000 });

    // Populated by default (seed data) — hints hidden.
    await expect(page.locator("#seoTitleAutoHint")).toHaveCount(0);
    await expect(page.locator("#seoDescriptionAutoHint")).toHaveCount(0);

    await seoTitle.fill("");
    await seoDescription.fill("");
    await page.waitForTimeout(200);

    const titleHint = page.locator("#seoTitleAutoHint");
    const descHint = page.locator("#seoDescriptionAutoHint");
    await expect(titleHint).toBeVisible();
    await expect(descHint).toBeVisible();
    await expect(descHint).toContainText("North Star Stories — Photographer.");

    // Informational, not error styling.
    expect(await titleHint.getAttribute("role")).not.toBe("alert");
    expect(await descHint.getAttribute("role")).not.toBe("alert");
    const hintColor = await titleHint.evaluate((el) => getComputedStyle(el).color);
    const destructiveColor = await page.evaluate(() => {
      const probe = document.createElement("p");
      probe.className = "text-destructive";
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(hintColor, "hint is not styled with the destructive/error color").not.toBe(destructiveColor);

    // Typing hides the hint live, without a save.
    await seoTitle.fill("A real title");
    await page.waitForTimeout(200);
    await expect(page.locator("#seoTitleAutoHint")).toHaveCount(0);
  });

  for (const locale of LOCALES) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} ${theme}: hint copy renders correctly with readable contrast`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(localePath(locale, "/settings/public-page"));
        const seoTitle = page.locator("#seoTitle");
        await seoTitle.waitFor({ state: "visible", timeout: 15_000 });
        await seoTitle.fill("");
        await page.waitForTimeout(300);

        const titleHint = page.locator("#seoTitleAutoHint");
        const expected = pick(locale, "app.settings.publicPage.seoTitleAutoHint");
        await expect(titleHint).toHaveText(expected);

        const [fg, bg] = await titleHint.evaluate((el) => {
          const color = getComputedStyle(el).color;
          let node: HTMLElement | null = el as HTMLElement;
          let background = "rgba(0,0,0,0)";
          while (node) {
            const bgc = getComputedStyle(node).backgroundColor;
            if (bgc && bgc !== "rgba(0, 0, 0, 0)" && bgc !== "transparent") {
              background = bgc;
              break;
            }
            node = node.parentElement;
          }
          // Chromium reports computed color in whatever color space the
          // declaring token used (oklch/lab tokens -> lab()/oklab() strings,
          // which our rgb()-only parser can't read) — normalize through a
          // canvas 2D context, which always serializes back to sRGB rgb()/rgba().
          function toRgb(c: string): string {
            // fillStyle serialization can preserve wide-gamut color functions
            // (lab()/oklab()) verbatim in modern Chromium, so read back actual
            // rasterized 8-bit sRGB pixel data instead of trusting the getter.
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = c;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            return `rgb(${r}, ${g}, ${b})`;
          }
          return [toRgb(color), toRgb(background)];
        });
        const ratio = contrastRatio(fg, bg);
        console.log(`[contrast] settings hint ${locale} ${theme} fg=${fg} bg=${bg} ratio=${ratio}`);
        expect(fg, "hint text color differs from resolved background").not.toBe(bg);
        if (ratio != null) {
          expect(ratio, `contrast ratio for settings hint text in ${theme}`).toBeGreaterThanOrEqual(4.5);
        }

        if (locale === "ar") {
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          const box = await titleHint.boundingBox();
          expect(box!.x, "hint does not clip off the left edge in RTL").toBeGreaterThanOrEqual(-1);
          expect(box!.x + box!.width, "hint does not clip off the right edge in RTL").toBeLessThanOrEqual(376);
        }

        if ((locale === "ar" || locale === "th") && theme === "dark") {
          await page.screenshot({
            path: `e2e/__screenshots__/settings-hint-375-${locale}-dark.png`,
          });
        }
      });
    }
  }
});
