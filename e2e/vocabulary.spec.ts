import { test, expect } from "@playwright/test";

// Run 1: owner picks Venue, app relabels (member read-only is unit-tested: no
// staff credentials in .env.local), owner resets to "Match business type". Run 2: marketing sweep (see below).

test.describe("vocabulary: owner", () => {
  test.setTimeout(240_000);

  test("owner sets Venue, app relabels, owner resets", async ({ page }) => {
    await page.goto("/settings/customize");
    const venue = page.getByRole("radio", { name: /venue/i }).first();
    await expect(venue).toBeEnabled({ timeout: 90_000 });
    await venue.click();
    await expect(venue).toHaveAttribute("aria-checked", "true");

    // Whole app relabels (router.refresh): sidebar words for the Venue preset.
    await expect(page.getByRole("link", { name: "Events" }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Hosts" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Venues" }).first()).toBeVisible();

    await page.goto("/teams");
    await expect(page.getByRole("heading", { name: /venues/i }).first()).toBeVisible({ timeout: 60_000 });
    expect(await page.locator("body").innerText()).not.toMatch(/%[A-Za-z_]+%/);
    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: /events/i }).first()).toBeVisible({ timeout: 60_000 });
    expect(await page.locator("body").innerText()).not.toMatch(/%[A-Za-z_]+%/);

    // Reset to "Match business type" so shared seed data is left as found.
    await page.goto("/settings/customize");
    const match = page.getByRole("radio").first();
    await match.click();
    await expect(match).toHaveAttribute("aria-checked", "true");
  });
});

// Run 2: public marketing home, 5 locales x light/dark x 3 breakpoints.
const LOCALES = ["en", "fil", "id", "ar", "th"] as const;
const THEMES = ["light", "dark"] as const;
const WIDTHS = [375, 768, 1280] as const;

test.describe("vocabulary: marketing sweep", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(600_000);

  test("sections reach in-view state, showcase fits, no raw tokens", async ({ browser }) => {
    const failures: string[] = [];
    for (const theme of THEMES) {
      const ctx = await browser.newContext();
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch {}
      }, theme);
      const page = await ctx.newPage();
      for (const locale of LOCALES) {
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(locale === "en" ? "/" : `/${locale}`, { waitUntil: "domcontentloaded" });
          await page.locator("#vocabulary-heading").waitFor({ state: "attached", timeout: 90_000 });
          // scroll through once so every reveal target intersects
          for (let y = 0; y <= (await page.evaluate(() => document.documentElement.scrollHeight)); y += 400) {
            await page.evaluate((v) => window.scrollTo(0, v), y);
            await page.waitForTimeout(60);
          }
          await page.waitForTimeout(900);
          const tag = `${locale}/${theme}/${width}`;
          const res = await page.evaluate(() => {
            const targets = Array.from(document.querySelectorAll("[data-r]"));
            const pendingEls = targets.filter((el) => !el.classList.contains("in"));
            const pending = pendingEls.length;
            const pendingInfo = pendingEls.map((el) => `${el.tagName}[${el.getAttribute("data-r")}]@${Math.round(el.getBoundingClientRect().top + scrollY)}/${document.documentElement.scrollHeight}:${(el.textContent || "").slice(0, 30)}`).join(" | ");
            const sec = document.querySelector("#vocabulary-heading")?.closest("section");
            const r = sec?.getBoundingClientRect();
            return {
              total: targets.length,
              pending,
              pendingInfo,
              overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
              secLeft: r?.left ?? -1,
              secRight: r?.right ?? -1,
              vw: window.innerWidth,
              tokens: /%[A-Za-z_]+%/.test(document.body.innerText),
              bodyChars: document.body.innerText.length,
            };
          });
          if (res.total === 0) failures.push(`${tag}: no [data-r] targets`);
          if (res.pending > 0) failures.push(`${tag}: ${res.pending}/${res.total} targets never reached in-view [${res.pendingInfo}]`);
          if (res.overflowX) failures.push(`${tag}: horizontal overflow`);
          if (res.secLeft < -1 || res.secRight > res.vw + 1) failures.push(`${tag}: showcase outside viewport`);
          if (res.tokens) failures.push(`${tag}: raw %token% in page text`);
          if (res.bodyChars < 500) failures.push(`${tag}: page looks broken (chars=${res.bodyChars})`);

          // chip interaction once per locale/theme at desktop: picking a preset flips labels
          if (width === 1280) {
            const chips = page.locator("#vocabulary-heading").locator("xpath=ancestor::section").getByRole("radio");
            const n = await chips.count();
            if (n < 2) failures.push(`${tag}: expected chips, got ${n}`);
            else {
              const before = await page.locator("#vocabulary-heading").locator("xpath=ancestor::section").innerText();
              await chips.nth(2).click();
              await page.waitForTimeout(700);
              const after = await page.locator("#vocabulary-heading").locator("xpath=ancestor::section").innerText();
              if (before === after) failures.push(`${tag}: chip click did not change labels`);
            }
          }
        }
      }
      await ctx.close();
    }

    // Reduced motion: final state with no scrolling.
    const rctx = await browser.newContext({ reducedMotion: "reduce" });
    const rp = await rctx.newPage();
    await rp.goto("/", { waitUntil: "domcontentloaded" });
    await rp.locator("#vocabulary-heading").waitFor({ state: "attached", timeout: 90_000 });
    await rp.waitForTimeout(1500);
    const pend = await rp.evaluate(
      () => Array.from(document.querySelectorAll("[data-r]")).filter((el) => !el.classList.contains("in")).length,
    );
    if (pend > 0) failures.push(`reduced-motion: ${pend} targets not in final state`);
    await rctx.close();

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
