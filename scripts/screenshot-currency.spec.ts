/**
 * Currency / FX screenshot harness.
 *
 * Walks every surface the local-currency branch touched and writes one JPEG
 * per (surface x locale x width x theme) into e2e/__screenshots__/currency/,
 * plus an index.html gallery, so the branch can be reviewed by eye.
 *
 * It is a capture harness, not a test: nothing is asserted, every capture is
 * isolated, and a surface that cannot be reached is recorded as SKIPPED in the
 * run summary instead of failing the run. Behavioural coverage lives in
 * e2e/currency-*.spec.ts, e2e/booking-fx-subtitle.spec.ts and
 * e2e/pricing-local-estimate.spec.ts.
 *
 * Read-only against the shared dev DB. The currency confirm dialog is opened
 * and cancelled, never confirmed — confirming would restate that workspace's
 * payment history and start a real 90-day cooldown.
 *
 *   pnpm exec playwright test scripts/screenshot-currency.spec.ts \
 *     --config scripts/playwright-currency-screenshots.config.ts
 */

import { test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_ROOT = path.resolve(__dirname, "..", "e2e", "__screenshots__", "currency");
// SHOT_AUTH_FILE lets a one-off run swap in a different seeded account's
// storage state (e.g. the expired-subscription owner) without touching the
// default active-owner captures.
const AUTH_STATE = path.resolve(
  __dirname,
  "..",
  "e2e",
  ".auth",
  process.env.SHOT_AUTH_FILE ?? "owner.json"
);

type TabKey = "beta" | "monthly" | "yearly";
type Combo = {
  locale: string;
  width: number;
  theme: "light" | "dark";
  /** Click this plan tab after the surface loads (default state is "beta"). */
  tab?: TabKey;
  /** CF-IPCountry header value — drives which Pro tier/currency renders. */
  country?: string;
};

// en covers the full 3-breakpoint x 2-theme grid; ar covers RTL at both
// extremes; fil/id/th each get a desktop shot so all five locales are visible.
// The exhaustive 5 x 3 x 2 grid is *asserted* by the e2e specs above — this is
// the human-reviewable subset.
const COMBOS: Combo[] = [
  { locale: "en", width: 375, theme: "light" },
  { locale: "en", width: 768, theme: "light" },
  { locale: "en", width: 1280, theme: "light" },
  { locale: "en", width: 375, theme: "dark" },
  { locale: "en", width: 1280, theme: "dark" },
  { locale: "ar", width: 375, theme: "light" },
  { locale: "ar", width: 1280, theme: "dark" },
  { locale: "fil", width: 1280, theme: "light" },
  { locale: "id", width: 1280, theme: "light" },
  { locale: "th", width: 1280, theme: "light" },
];

type Surface = {
  dir: string;
  title: string;
  anonymous?: boolean;
  viewportOnly?: boolean; // modal shots: capture the viewport, not the full page
  drive: (page: Page, combo: Combo) => Promise<void>;
  /** Switches the Beta/Monthly/Annual plan tab after drive() lands. */
  clickTab?: (page: Page, tab: TabKey) => Promise<void>;
  /** Extra combos layered on top of COMBOS, e.g. tab or country variants. */
  extraCombos?: Combo[];
};

// 01/02 render the toggle as plain buttons tagged data-testid="plan-tab-<key>".
// 03/09/13 render it via the shared SegmentedToggle (role="tab"), first-to-last
// beta/monthly/yearly — safe to index because BETA_TESTER_ENABLED is on in
// this env, so all three options are always present.
async function clickPlanTabByTestId(page: Page, tab: TabKey): Promise<void> {
  const btn = page.getByTestId(`plan-tab-${tab}`);
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  await btn.click();
}
async function clickPlanTabByRole(page: Page, tab: TabKey): Promise<void> {
  const idx = tab === "beta" ? 0 : tab === "monthly" ? 1 : 2;
  const t = page.getByRole("tab").nth(idx);
  await t.waitFor({ state: "visible", timeout: 15_000 });
  await t.click();
}

// Non-"beta" tab states for the toggle-fit + i18n judging pass: 375px is the
// priority breakpoint (longest labels in ar/th), with a couple of desktop and
// dark-theme checks thrown in. "beta" itself is already the default state
// captured by COMBOS, so it isn't repeated here.
const TAB_JUDGE_COMBOS: Combo[] = [
  { locale: "en", width: 375, theme: "light", tab: "monthly" },
  { locale: "en", width: 375, theme: "light", tab: "yearly" },
  { locale: "en", width: 1280, theme: "light", tab: "yearly" },
  { locale: "ar", width: 375, theme: "light", tab: "monthly" },
  { locale: "ar", width: 375, theme: "dark", tab: "yearly" },
  { locale: "ar", width: 1280, theme: "light", tab: "yearly" },
  { locale: "th", width: 375, theme: "light", tab: "monthly" },
  { locale: "th", width: 375, theme: "light", tab: "yearly" },
  { locale: "fil", width: 375, theme: "light", tab: "monthly" },
  { locale: "id", width: 375, theme: "light", tab: "yearly" },
];

// One combo per country in the tier table — headline currency/tier is what's
// under test, so locale/breakpoint/theme stay fixed at a single baseline.
const COUNTRY_MATRIX = ["PH", "ID", "TH", "US", "AE", "JP"];
// tab: "monthly" — the default Beta tab is free and shows no price, so it
// can't reveal the per-country tier/currency. Force the paid tab open.
const COUNTRY_COMBOS: Combo[] = COUNTRY_MATRIX.map((cc) => ({
  locale: "en",
  width: 1280,
  theme: "light",
  tab: "monthly",
  country: cc,
}));

// Money renders as "₱1,234.00" under en, but non-en locales format the same
// PHP amount with an alphabetic code and locale digits, so this is only ever a
// best-effort "the data has landed" hint — never a hard gate on the capture.
const MONEY = /(₱|PHP)\s?[\d٠-٩๐-๙,.]/;

function localePath(locale: string, p: string): string {
  return locale === "en" ? p : `/${locale}${p}`;
}

/** Wait for the shell, then give the money figures a short grace period. */
async function settled(page: Page): Promise<void> {
  await page.locator("main").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .getByText(MONEY)
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
}

class Unreachable extends Error {}

// The FX booking is found once (via the mobile card list, whose rows are
// reliably clickable) and then reached by ?detail=<id> for every other combo.
let fxBookingId: string | null | undefined;

async function resolveFxBookingId(page: Page): Promise<string | null> {
  if (fxBookingId !== undefined) return fxBookingId;

  const original = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/bookings", { waitUntil: "domcontentloaded" });
  const search = page.getByRole("textbox").first();
  await search.waitFor({ state: "visible", timeout: 60_000 });
  await search.fill("Playwright FX Subtitle");
  await page.waitForTimeout(2_000);

  const row = page.getByText(/Playwright FX Subtitle/).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForURL((u) => u.searchParams.has("detail"), { timeout: 20_000 }).catch(() => {});
    fxBookingId = new URL(page.url()).searchParams.get("detail");
  } else {
    fxBookingId = null;
  }

  if (original) await page.setViewportSize(original);
  return fxBookingId;
}

const SURFACES: Surface[] = [
  {
    dir: "01-landing-pricing-teaser",
    title: "Landing page — pricing teaser (local estimate under the price)",
    anonymous: true,
    clickTab: clickPlanTabByTestId,
    extraCombos: [...TAB_JUDGE_COMBOS, ...COUNTRY_COMBOS],
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/"), { waitUntil: "domcontentloaded" });
      const section = page.locator("#pricing");
      await section.waitFor({ state: "visible", timeout: 45_000 });
      await section.scrollIntoViewIfNeeded();
    },
  },
  {
    dir: "02-pricing-page",
    title: "/pricing — per-request render with the local estimate",
    anonymous: true,
    clickTab: clickPlanTabByTestId,
    extraCombos: [...TAB_JUDGE_COMBOS, ...COUNTRY_COMBOS],
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/pricing"), { waitUntil: "domcontentloaded" });
      await settled(page);
    },
  },
  {
    dir: "03-subscribe",
    title: "/subscribe — Pro panel with the local estimate",
    clickTab: clickPlanTabByRole,
    extraCombos: [...TAB_JUDGE_COMBOS, ...COUNTRY_COMBOS],
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/subscribe"), { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (!page.url().includes("/subscribe")) {
        throw new Unreachable(`redirected to ${page.url()}`);
      }
    },
  },
  {
    dir: "13-onboarding-plan-step",
    title: "Onboarding — plan step (needs a not-yet-onboarded account)",
    clickTab: clickPlanTabByRole,
    extraCombos: [...TAB_JUDGE_COMBOS, ...COUNTRY_COMBOS],
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/onboarding/plan"), {
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (!page.url().includes("/onboarding/plan")) {
        throw new Unreachable(`redirected to ${page.url()} — seeded owner is already onboarded`);
      }
      await settled(page);
    },
  },
  {
    dir: "04-dashboard",
    title: "Dashboard (bookings) — multi-currency roll-up in the workspace currency",
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/dashboard?tab=bookings"), {
        waitUntil: "domcontentloaded",
      });
      await settled(page);
    },
  },
  {
    dir: "11-dashboard-portfolio",
    title: "Dashboard (portfolio) — card layout and space usage",
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/dashboard?tab=portfolio"), {
        waitUntil: "domcontentloaded",
      });
      await settled(page);
    },
  },
  {
    dir: "05-clients-list",
    title: "Clients list — Total Spent converted at read time",
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/clients"), { waitUntil: "domcontentloaded" });
      await settled(page);
    },
  },
  {
    dir: "06-client-detail-modal",
    title: "Client detail modal — same converted figure as the list row",
    viewportOnly: true,
    drive: async (page, combo) => {
      // Open the client that actually carries a foreign-currency payment — the
      // point of this surface is the converted figure, and whoever sorts first
      // in the unfiltered list usually has no payments at all. ?q= filters
      // server-side, which is steadier than driving the search box (its input
      // isn't the first one in the DOM at every breakpoint). Falls back to the
      // unfiltered list when the FX fixture is absent, e.g. after a reseed.
      const FX_CLIENT = "Playwright FX Client";
      await page.goto(
        localePath(combo.locale, `/clients?q=${encodeURIComponent(FX_CLIENT)}`),
        { waitUntil: "domcontentloaded" }
      );
      await settled(page);
      let table = page.locator("table tbody tr").first();
      let card = page.locator('[data-testid="clients-card-list"] article').first();
      const filteredHit =
        (await table.isVisible().catch(() => false)) ||
        (await card.isVisible().catch(() => false));
      if (!filteredHit) {
        await page.goto(localePath(combo.locale, "/clients"), { waitUntil: "domcontentloaded" });
        await settled(page);
        table = page.locator("table tbody tr").first();
        card = page.locator('[data-testid="clients-card-list"] article').first();
      }
      const row = (await table.isVisible().catch(() => false)) ? table : card;
      await row.waitFor({ state: "visible", timeout: 30_000 });
      await row.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible", timeout: 20_000 });
      // Payments tab (3rd): where a foreign-currency record carries its
      // workspace-currency subtitle. Switched by position — the tab labels are
      // localized.
      const paymentsTab = dialog.getByRole("tab").nth(2);
      if (await paymentsTab.isVisible().catch(() => false)) {
        await paymentsTab.click();
      }
      await page.waitForTimeout(1_500);
    },
  },
  {
    dir: "07-settings-workspace-currency",
    title: "Settings > Workspace — currency field and its restatement warning",
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/settings/workspace"), {
        waitUntil: "domcontentloaded",
      });
      const select = page.locator("#currency");
      await select.waitFor({ state: "visible", timeout: 60_000 });
      await select.scrollIntoViewIfNeeded();
    },
  },
  {
    dir: "08-currency-confirm-dialog",
    title: "Currency change — confirm dialog (opened, then cancelled)",
    viewportOnly: true,
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/settings/workspace"), {
        waitUntil: "domcontentloaded",
      });
      const select = page.locator("#currency");
      await select.waitFor({ state: "visible", timeout: 60_000 });
      if (await select.isDisabled()) {
        throw new Unreachable("currency field is locked (cooldown active) on this workspace");
      }
      // The select is server-rendered before the form hydrates; a change
      // fired too early is swallowed and the dialog never opens.
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1_500);

      const original = await select.inputValue();
      const values = await select
        .locator("option")
        .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
      const next = values.find((v) => v !== original);
      if (!next) throw new Unreachable("no alternate currency option");

      const dialog = page.getByRole("dialog");
      for (let attempt = 0; attempt < 3; attempt++) {
        await select.selectOption(next);
        const opened = await dialog
          .waitFor({ state: "visible", timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        if (opened) break;
        await select.selectOption(original); // reset before retrying
        await page.waitForTimeout(1_000);
      }
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(1_200); // let the restatement preview count resolve
    },
  },
  {
    dir: "09-settings-billing",
    title: "Settings > Billing — Pro row with the local estimate",
    clickTab: clickPlanTabByRole,
    extraCombos: [...TAB_JUDGE_COMBOS, ...COUNTRY_COMBOS],
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/settings/billing"), {
        waitUntil: "domcontentloaded",
      });
      await settled(page);
    },
  },
  {
    dir: "12-bookings-list",
    title: "Bookings list — every row in the workspace currency",
    drive: async (page, combo) => {
      await page.goto(localePath(combo.locale, "/bookings"), { waitUntil: "domcontentloaded" });
      await settled(page);
    },
  },
  {
    dir: "10-booking-fx-subtitle",
    title: "Booking detail — frozen FX rate subtitle on a foreign-currency booking",
    viewportOnly: true,
    drive: async (page, combo) => {
      // The subtitle only renders for a booking whose currency differs from
      // the workspace currency and has a paid payment. e2e/booking-fx-subtitle
      // .spec.ts creates exactly one such booking per run — reuse it rather
      // than writing more rows into the shared dev DB.
      const id = await resolveFxBookingId(page);
      if (!id) {
        throw new Unreachable("no FX booking found — run e2e/booking-fx-subtitle.spec.ts first");
      }
      await page.goto(localePath(combo.locale, `/bookings?detail=${id}`), {
        waitUntil: "domcontentloaded",
      });
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible", timeout: 30_000 });
      // The frozen-rate subtitle lives on the Payments tab (3rd), under the
      // paid payment row — the modal opens on Client, so switch by position
      // rather than by a localized tab label.
      const payments = dialog.getByRole("tab").nth(2);
      await payments.waitFor({ state: "visible", timeout: 20_000 });
      await payments.click();
      await dialog
        .getByText(/≈/)
        .first()
        .waitFor({ state: "visible", timeout: 20_000 })
        .catch(() => {});
      await page.waitForTimeout(800);
    },
  },
];

type Result = { surface: string; combo: Combo; status: "ok" | "skipped" | "failed"; note?: string };

async function capture(
  browser: Browser,
  surface: Surface,
  combo: Combo,
  baseURL: string
): Promise<Result> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: combo.width, height: 900 },
    storageState: surface.anonymous ? undefined : AUTH_STATE,
    locale: "en-US",
    reducedMotion: "reduce",
    extraHTTPHeaders: combo.country ? { "cf-ipcountry": combo.country } : undefined,
  });
  // next-themes reads this key in its blocking init script on first paint.
  await context.addInitScript((t) => {
    window.localStorage.setItem("theme", t as string);
  }, combo.theme);

  const page = await context.newPage();
  try {
    await surface.drive(page, combo);
    if (combo.tab && combo.tab !== "beta" && surface.clickTab) {
      // The toggle buttons are server-rendered before hydration finishes; a
      // click fired too early lands on an un-wired button and is silently a
      // no-op (same class of race as the 08 currency-confirm-dialog surface).
      await page.waitForLoadState("networkidle").catch(() => {});
      try {
        await surface.clickTab(page, combo.tab);
      } catch {
        throw new Unreachable("plan tab toggle not present (account already subscribed/beta)");
      }
      await page.waitForTimeout(700);
    }
    if (!surface.viewportOnly) {
      // Chromium's fullPage capture resizes the viewport, which remounts the
      // charts and restarts their entry animation — the shot then shows an
      // empty plot area. Grow the viewport to the page first, then let the
      // charts finish drawing before the capture.
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({
        width: combo.width,
        height: Math.min(Math.max(pageHeight, 900), 8_000),
      });
    }
    // recharts' entry animation runs 1.5s and restarts on the resize above.
    await page.waitForTimeout(1_200);
    const dir = path.join(OUT_ROOT, surface.dir);
    fs.mkdirSync(dir, { recursive: true });
    const nameParts = [combo.locale, `${combo.width}px`, combo.theme];
    if (combo.tab) nameParts.push(combo.tab);
    if (combo.country) nameParts.push(`cc-${combo.country}`);
    await page.screenshot({
      path: path.join(dir, `${nameParts.join("-")}.jpg`),
      type: "jpeg",
      quality: 60,
      fullPage: !surface.viewportOnly,
    });
    return { surface: surface.dir, combo, status: "ok" };
  } catch (err) {
    const note = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return {
      surface: surface.dir,
      combo,
      status: err instanceof Unreachable ? "skipped" : "failed",
      note,
    };
  } finally {
    await context.close();
  }
}

function writeGallery(results: Result[]): void {
  // Built from what is on disk, not just this run's results, so a partial
  // re-run (SHOT_SURFACES=...) still produces a complete gallery.
  const rows = SURFACES.map((s) => {
    const dir = path.join(OUT_ROOT, s.dir);
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort()
      : [];
    const shots = files
      .map((f) => {
        // Base combos are "<locale>-<width>px-<theme>"; tab/country combos
        // append "-<tab>" and/or "-cc-<CODE>" — just show the whole stem.
        const label = f.replace(/\.jpg$/, "").split("-").join(" · ");
        return `      <figure>
        <a href="${s.dir}/${f}"><img loading="lazy" src="${s.dir}/${f}" alt=""></a>
        <figcaption>${label}</figcaption>
      </figure>`;
      })
      .join("\n");
    const missing = results.filter((r) => r.surface === s.dir && r.status !== "ok");
    const note = missing.length
      ? `      <p class="note">${missing.length} not captured: ${[
          ...new Set(missing.map((m) => m.note ?? m.status)),
        ].join(" · ")}</p>`
      : "";
    return `    <section>
      <h2>${s.title}</h2>
${note}
      <div class="grid">
${shots}
      </div>
    </section>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Currency / FX branch — screenshot gallery</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0 auto; max-width: 1200px; padding: 2rem 1rem 4rem; line-height: 1.5; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.05rem; margin: 2.5rem 0 .25rem; }
  .note { margin: .25rem 0; font-size: .85rem; opacity: .7; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  figure { margin: 0; }
  img { width: 100%; height: auto; border: 1px solid rgba(128,128,128,.35); border-radius: 6px; }
  figcaption { font-size: .8rem; opacity: .75; padding-top: .35rem; }
</style>
</head>
<body>
  <h1>Currency / FX branch — screenshot gallery</h1>
  <p>Captured by <code>scripts/screenshot-currency.spec.ts</code>. Click any shot for full size.</p>
${rows}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_ROOT, "index.html"), html, "utf8");
}

test("capture currency surfaces", async ({ browser, baseURL }) => {
  // SHOT_SURFACES="04,07" re-captures only those surfaces (their existing
  // JPEGs are overwritten; every other surface keeps the shots it has).
  const only = (process.env.SHOT_SURFACES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const results: Result[] = [];
  for (const surface of SURFACES) {
    if (only.length && !only.some((o) => surface.dir.startsWith(o))) continue;
    const combos = [...COMBOS, ...(surface.extraCombos ?? [])];
    for (const combo of combos) {
      let r = await capture(browser, surface, combo, baseURL ?? "http://localhost:3000");
      if (r.status === "failed") {
        r = await capture(browser, surface, combo, baseURL ?? "http://localhost:3000");
      }
      results.push(r);
      const tag = r.status === "ok" ? "ok" : r.status.toUpperCase();
      const extra = [combo.tab, combo.country ? `cc-${combo.country}` : null].filter(Boolean).join(" ");
      console.log(
        `[${tag}] ${surface.dir} ${combo.locale} ${combo.width}px ${combo.theme}${extra ? " " + extra : ""}` +
          (r.note ? ` — ${r.note}` : "")
      );
    }
  }
  writeGallery(results);

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed");
  console.log(`\ncaptured ${ok} · skipped ${skipped} · failed ${failed.length}`);
  for (const f of failed) {
    console.log(`  FAILED ${f.surface} ${f.combo.locale} ${f.combo.width}px ${f.combo.theme}: ${f.note}`);
  }
});
