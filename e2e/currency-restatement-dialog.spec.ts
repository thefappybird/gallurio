/**
 * Currency-change confirm dialog on Settings > Workspace, read-only against
 * the shared seeded dev DB.
 *
 * Deliberately never confirms the change: doing so would restate that
 * workspace's payment history and start a real 90-day cooldown with no way
 * to undo it. Each test opens the dialog (a real read via
 * previewCurrencyRestatementAction) then cancels, and asserts the select
 * reverted rather than committed.
 *
 * The locked/disabled-select state cannot be reached without an actual
 * restating change (see above), so it is NOT covered here — it is covered by
 * the WorkspaceBusinessForm vitest suite, which renders the component
 * directly with a synthetic currencyLockedUntil prop.
 */
import { test, expect, type Page } from "@playwright/test";

const DIALOG_TITLE: Record<string, string> = {
  en: "Change workspace currency?",
  fil: "Palitan ang currency ng workspace?",
  id: "Ubah mata uang workspace?",
  ar: "تغيير عملة مساحة العمل؟",
  th: "เปลี่ยนสกุลเงินของพื้นที่ทำงานหรือไม่?",
};

const CANCEL_LABEL: Record<string, string> = {
  en: "Cancel",
  fil: "Kanselahin",
  id: "Batal",
  ar: "إلغاء",
  th: "ยกเลิก",
};

const LOCALES = Object.keys(DIALOG_TITLE);

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

function hasOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
}

for (const locale of LOCALES) {
  for (const width of [375, 768, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} @ ${width}px ${theme} — confirm dialog opens on change, cancel reverts`, async ({
        page,
      }) => {
        // next-themes reads this key in its blocking init script on first
        // paint (attribute="class", so it lands as html.dark).
        await page.addInitScript((t) => {
          window.localStorage.setItem("theme", t as string);
        }, theme);

        const errors = trackConsoleErrors(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/settings/workspace`);

        const select = page.locator("#currency");
        await expect(select).toBeVisible({ timeout: 30_000 });
        test.skip(await select.isDisabled(), "currency field is locked on this workspace");

        const originalValue = await select.inputValue();
        const optionValues = await select
          .locator("option")
          .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
        const nextValue = optionValues.find((v) => v !== originalValue);
        expect(nextValue, "no alternate currency option available").toBeTruthy();

        await select.selectOption(nextValue!);

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible({ timeout: 15_000 });

        // Assert the rendered string, not a test id — catches mojibake.
        const title = dialog.getByText(DIALOG_TITLE[locale]);
        await expect(title).toBeVisible();

        if (locale === "ar") {
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          const titleBox = await title.boundingBox();
          const dialogBox = await dialog.boundingBox();
          expect(titleBox).not.toBeNull();
          expect(dialogBox).not.toBeNull();
          // 1px tolerance for subpixel rounding.
          expect(titleBox!.x).toBeGreaterThanOrEqual(dialogBox!.x - 1);
          expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(
            dialogBox!.x + dialogBox!.width + 1
          );
        }

        if (theme === "dark") {
          await expect(page.locator("html")).toHaveClass(/dark/);
          const titleColor = await title.evaluate((el) => getComputedStyle(el).color);
          const dialogBg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(titleColor).not.toBe(dialogBg);
        }

        expect(await hasOverflow(page), "document has horizontal overflow").toBe(false);

        // Never confirm — cancelling is what keeps the shared dev DB intact.
        await dialog.getByRole("button", { name: CANCEL_LABEL[locale] }).click();
        await expect(dialog).toBeHidden({ timeout: 10_000 });
        await expect(select).toHaveValue(originalValue);

        expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
      });
    }
  }
}
