import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Verifies the validation-error contract this branch establishes: an invalid
 * control is marked aria-invalid AND its message is reachable from that
 * control via aria-describedby, so colour is never the only signal.
 *
 * Deliberately non-mutating: every flow stops at the blocked-submit state, so
 * nothing is written to the shared seeded dev DB.
 */

const BREAKPOINTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
] as const;

/** The full contract: invalid control + resolvable visible role=alert message. */
async function expectWiredError(
  page: Page,
  control: Locator,
  label: string,
): Promise<string> {
  await expect(control, `${label}: control must be marked invalid`).toHaveAttribute(
    "aria-invalid",
    /true/,
  );

  const describedBy = await control.getAttribute("aria-describedby");
  expect(describedBy, `${label}: control must reference its message`).toBeTruthy();

  // aria-describedby may list several ids; at least one must be a live alert.
  const ids = describedBy!.split(/\s+/).filter(Boolean);
  let matched: Locator | null = null;
  for (const id of ids) {
    // Attribute selector, not `#id`: ids here are generated (useId produces
    // colons) and CSS.escape is a browser API not available in the test runner.
    const el = page.locator(`[id="${id}"]`).first();
    if ((await el.count()) === 0) continue;
    if (!(await el.isVisible().catch(() => false))) continue;
    if ((await el.getAttribute("role")) === "alert") {
      matched = el;
      break;
    }
  }
  expect(matched, `${label}: no visible role="alert" among ids "${describedBy}"`).not.toBeNull();

  const text = (await matched!.innerText()).trim();
  expect(text.length, `${label}: the message must not be empty`).toBeGreaterThan(0);
  return text;
}

test("booking wizard: an invalid new-client email is surfaced at 375/768/1280", async ({
  page,
}) => {
  test.setTimeout(180_000);

  for (const bp of BREAKPOINTS) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto("/bookings?add=1");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 60_000 });

    await dialog.getByRole("button", { name: "Create new" }).click();
    await dialog.locator("#client-new-name").fill("Playwright Check");
    await dialog.locator("#client-new-email").fill("not-an-email");

    // Advancing runs the client step's validation.
    await dialog.getByRole("button", { name: "Next" }).click();

    await expectWiredError(page, dialog.locator("#client-new-email"), `email @${bp.name}`);

    // The step must not have advanced past the client step.
    await expect(dialog.locator("#client-new-email")).toBeVisible();
  }
});

test("client modal: an invalid email reaches app validation, not the browser bubble", async ({
  page,
}) => {
  test.setTimeout(180_000);

  for (const bp of BREAKPOINTS) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto("/clients");

    await page
      .getByRole("button", { name: /new client|add client/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 60_000 });

    await dialog.locator("#cf-name").fill("Playwright Check");
    await dialog.locator("#cf-email").fill("not-an-email");
    await dialog.getByRole("button", { name: /^(save|create|add client)/i }).first().click();

    // Without noValidate the browser's own bubble swallowed submit and this
    // message never appeared, so this is the regression guard for that fix.
    await expectWiredError(page, dialog.locator("#cf-email"), `client email @${bp.name}`);

    await page.keyboard.press("Escape");
  }
});

test("select trigger: aria-invalid actually paints a destructive outline", async ({
  page,
}) => {
  // Chunk 1b guard. input/textarea already carried aria-invalid styling, but
  // select and combobox did not, so setting aria-invalid on a dropdown used to
  // produce NO visual change at all — colour-blind to the user and silent.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/clients");

  await page.getByRole("button", { name: /new client|add client/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 60_000 });

  const trigger = dialog.locator('[data-slot="select-trigger"]').first();
  await expect(trigger).toBeVisible();

  const before = await trigger.evaluate((el) => getComputedStyle(el).borderColor);
  await trigger.evaluate((el) => el.setAttribute("aria-invalid", "true"));
  const after = await trigger.evaluate((el) => getComputedStyle(el).borderColor);

  expect(
    after,
    "aria-invalid must change the select trigger's border, or the outline is inert on every dropdown",
  ).not.toBe(before);

  await page.keyboard.press("Escape");
});

test.describe("auth (unauthenticated)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sign-in: a failed credential check reveals nothing per-field", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/sign-in");

    await page.locator("#signin-email").fill("definitely-not-a-user@example.com");
    await page.locator("#signin-password").fill("wrong-password-value");
    await page.locator('button[type="submit"]').click();

    // The generic form-level error is the ONLY thing allowed to appear.
    await expect(page.locator("#signin-error")).toBeVisible({ timeout: 45_000 });

    // The enumeration guard: marking either field invalid would tell an
    // attacker which half of the credential pair was wrong.
    await expect(page.locator("#signin-email")).not.toHaveAttribute(
      "aria-invalid",
      /true/,
    );
    await expect(page.locator("#signin-password")).not.toHaveAttribute(
      "aria-invalid",
      /true/,
    );
  });

  test("sign-up: a password mismatch lands on the confirm field at 375/768/1280", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto("/sign-up");

      await page.locator("#signup-firstname").fill("Playwright");
      // Never reused, and the request is rejected before any account is made.
      await page.locator("#signup-email").fill(`pw-check-${Date.now()}@example.com`);
      await page.locator('input[name="password"]').fill("correct-horse-battery");
      await page
        .locator('input[name="confirmPassword"]')
        .fill("a-different-value-entirely");
      await page.locator('button[type="submit"]').click();

      const confirm = page.locator('input[name="confirmPassword"]');
      const message = await expectWiredError(page, confirm, `confirm @${bp.name}`);

      // The identical sentence must not ALSO render as a form-level error.
      const occurrences = await page.getByText(message, { exact: true }).count();
      expect(
        occurrences,
        `@${bp.name}: the mismatch message must render exactly once, saw ${occurrences}`,
      ).toBe(1);
    }
  });
});
