/**
 * RTL is scoped to the contact form + featured-work popup (and its nested
 * image lightbox) only — general manual-block canvas/preview content must
 * never mirror for RTL, and the canvas swatches must follow the portfolio's
 * OWN formLocale/formDir, never the CRM UI's own route locale (the bug: the
 * contact swatch used to resolve copy via useTranslations(), bound to the
 * CRM locale segment; the popup/lightbox never received RTL at all, since
 * both portal to document.body, escaping any ancestor's dir attribute).
 *
 * One session, one login, no re-navigation — editor-internal surfaces are
 * 1280px only per the portfolio-testing skill's budget rules. Read-only:
 * nothing is saved or published, so the shared seeded workspace is left
 * exactly as found (formLocale/formDir are local draft/component state
 * until Save).
 */
import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

const SHELL = "[data-testid='portfolio-editor-shell']";
const CHEVRON_LEFT_D = "m15 18-6-6 6-6";
const CHEVRON_RIGHT_D = "m9 18 6-6-6-6";

test.use({ viewport: { width: 1280, height: 900 } });

test("RTL stays scoped to contact form + featured-work popup/lightbox; general content and canvas stay LTR", async ({ page }) => {
  await openEditorWithDraft(page, "Minimal Template");

  const shell = page.locator(SHELL);
  await expect(shell).toHaveAttribute("dir", "ltr");

  // Switch the portfolio's OWN language to Arabic (RTL) — local draft-state
  // only, never saved/published here. At 1280px the canvas-control cluster
  // (including the language picker) collapses into a popover — a CSS
  // container query on the header's own width, not the viewport.
  await page.getByTestId("canvas-controls-trigger").click();
  // Both the inline and popover-collapsed copies of the control cluster are
  // always mounted (CSS container-query toggles display:none) — scope to
  // the one actually visible at this width.
  await page.locator('[data-testid="language-control"]:visible').click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();

  // General canvas content (the Puck editing surface itself) must NOT mirror.
  await expect(shell).toHaveAttribute("dir", "ltr");

  // Contact Form settings swatch must follow the portfolio's formLocale (ar),
  // even though the CRM route locale here is "en" — the regression this
  // guards against would still render the English "Get in touch" heading.
  await page.locator('[data-tour-id="contact-tab"]').click();
  const contactSwatch = page.locator('[data-tour-id="contact-form-preview"] > div').first();
  await expect(contactSwatch).toHaveAttribute("dir", "rtl");
  // The heading itself is the workspace's own custom title (verbatim content,
  // never translated) — assert on a chrome-copy field label instead, which
  // IS resolved from messages/{formLocale}.json.
  await expect(contactSwatch.getByText("الاسم", { exact: true })).toBeVisible();

  // Featured Work popup settings swatch — same rule, structural only.
  await page.locator('button:has-text("Featured Popup")').first().click();
  const popupSwatch = page.locator('[data-testid="collections-popup-preview-root"]');
  await expect(popupSwatch).toHaveAttribute("dir", "rtl");

  // Back to Home, then the real Preview iframe — general blocks (Hero,
  // Services, etc.) must stay LTR-structured there too.
  await page.locator('button:has-text("Home")').first().click();
  await page.locator('button:has-text("Preview")').first().click();
  const frame = page.frameLocator('iframe[title="Live preview"]');
  await expect(frame.locator("body")).toBeVisible({ timeout: 15_000 });

  // Click the real "Glow" featured-work tile (a seeded 5-photo collection) —
  // this is the genuine interactive path (unlike the editing canvas, where
  // Puck's overlay intercepts clicks for block selection), so it opens the
  // REAL CollectionPopup with its REAL fetch, exactly as on the published
  // site and previously reported as never flipping (bug 2.2).
  await frame.getByText("Glow", { exact: true }).click();
  const popupShell = frame.locator("[data-popup-shell]");
  await expect(popupShell).toBeVisible({ timeout: 15_000 });
  await expect(popupShell).toHaveAttribute("dir", "rtl");

  // Open the nested image lightbox and confirm its prev/next chevrons are
  // swapped for RTL (Lightbox previously hardcoded ChevronLeft/Right
  // regardless of direction).
  await frame.locator("[data-popup-thumb]").first().click();
  // CollectionPopup doesn't pass Lightbox a `labels` prop, so it falls back
  // to its own English defaults ("Previous image"/"Next image") regardless
  // of formLocale — a separate, pre-existing gap, not part of this fix.
  const prevBtn = frame.getByRole("button", { name: "Previous image" });
  const nextBtn = frame.getByRole("button", { name: "Next image" });
  await expect(prevBtn).toBeVisible({ timeout: 10_000 });
  await expect(prevBtn.locator("path")).toHaveAttribute("d", CHEVRON_RIGHT_D);
  await expect(nextBtn.locator("path")).toHaveAttribute("d", CHEVRON_LEFT_D);
});
