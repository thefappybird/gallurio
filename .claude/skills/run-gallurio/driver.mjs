// driver.mjs — launch a real browser, sign in as the seeded owner, and drive
// the running Gallurio dev server. This is the agent-facing handle on the app:
// it screenshots any authenticated route at desktop + 375px so a future agent
// can SEE a change working, not just compile it.
//
// Prereqs (the SKILL.md covers these):
//   1. `pnpm dev` is already running on http://localhost:3000 (Turnstile is
//      bypassed because NODE_ENV=development).
//   2. .env.local holds SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD (canonical dev
//      checkout already has them; a worktree must copy them in).
//   3. `@playwright/test` is installed and its chromium browser is present.
//
// Usage:
//   node .claude/skills/run-gallurio/driver.mjs <route> [--mobile] [--out <dir>]
//   node .claude/skills/run-gallurio/driver.mjs /dashboard
//   node .claude/skills/run-gallurio/driver.mjs /inquiries --mobile
//
// Screenshots land in <out>/ (default: ./.driver-shots/) as
// <slug>-<width>.png. The script logs in once per run and reuses the session
// for every screenshot, so pass multiple routes to avoid re-auth:
//   node .claude/skills/run-gallurio/driver.mjs /dashboard /inquiries /calendar
import { chromium } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Resolve repo root from this file's location (.claude/skills/run-gallurio/).
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env.local") });

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const argv = process.argv.slice(2);
let outDir = path.join(repoRoot, ".driver-shots");
let mobile = false;
const routes = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--mobile") mobile = true;
  else if (a === "--out") outDir = path.resolve(argv[++i]);
  else routes.push(a);
}
if (routes.length === 0) routes.push("/dashboard");

const email = process.env.SEED_OWNER_EMAIL;
const password = process.env.SEED_OWNER_PASSWORD;
if (!email || !password) {
  console.error(
    "ERROR: SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD missing from .env.local.\n" +
      "A worktree starts without .env.local — copy it from the canonical dev checkout."
  );
  process.exit(2);
}

const slug = (r) =>
  (r.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home").toLowerCase();

const viewport = mobile
  ? { width: 375, height: 812 }
  : { width: 1280, height: 900 };

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport, locale: "en-US" });
const page = await context.newPage();

try {
  // --- Sign in (mirrors e2e/auth.setup.ts) -------------------------------
  console.log(`> signing in as ${email} at ${BASE}/sign-in`);
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.locator('button[type="submit"]').click();
  // First authenticated route compiles cold under Turbopack — be patient.
  await page.waitForURL(
    (url) => /\/(dashboard|bookings|onboarding|inquiries)\b/.test(url.pathname),
    { timeout: 90_000 }
  );
  console.log(`> authenticated, landed on ${new URL(page.url()).pathname}`);

  // --- Screenshot each requested route -----------------------------------
  for (const route of routes) {
    // Accept "/dashboard", "dashboard", or a full URL. A bare name (no leading
    // slash) is the safe form for Git Bash, whose MSYS path conversion rewrites
    // a leading-slash arg into a Windows path before node ever sees it.
    const target = route.startsWith("http")
      ? route
      : `${BASE}/${route.replace(/^\/+/, "")}`;
    await page.goto(target, { waitUntil: "networkidle", timeout: 60_000 });
    const file = path.join(outDir, `${slug(route)}-${viewport.width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`> ${route} -> ${file}`);
  }
} catch (err) {
  const crash = path.join(outDir, "error.png");
  await page.screenshot({ path: crash, fullPage: true }).catch(() => {});
  console.error(`! driver failed: ${err.message}`);
  console.error(`! see ${crash} for the page state at failure`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
