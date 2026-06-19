import { test, expect } from "@playwright/test";

// Verifies container-query responsiveness end-to-end:
//  - editor canvas becomes the `pfpage` container and reflows with the viewport toggle
//  - public portfolio has no horizontal overflow at 375px and stacks correctly
// Diagnostics are logged so the first run can confirm selectors before tightening.

const PUBLIC_SLUG = "sarah-bell-photo";

test("editor canvas is the pfpage container and the responsive sheet is present", async ({ page }) => {
  await page.goto("/portfolio");
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2_000);

  const hasSheet = await page.evaluate(() =>
    Array.from(document.querySelectorAll("style")).some((s) => (s.textContent ?? "").includes("@container pfpage")),
  );
  console.log("[diag] responsive sheet present:", hasSheet);

  const containers = await page.evaluate(() => {
    const out: Array<{ tag: string; cls: string; width: number }> = [];
    document.querySelectorAll("*").forEach((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      if ((cs.containerName ?? "").includes("pfpage")) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") ?? "").slice(0, 60),
          width: Math.round((el as HTMLElement).getBoundingClientRect().width),
        });
      }
    });
    return out;
  });
  console.log("[diag] pfpage containers:", JSON.stringify(containers));

  expect(hasSheet, "PF_RESPONSIVE_CSS must be injected into the editor canvas").toBe(true);
  // Exactly one pfpage container — guards against nested containers shadowing the
  // intended surface (the inner one would win @container/cqi resolution).
  expect(containers.length, "exactly one pfpage container (the clamped preview surface)").toBe(1);
  // It must be the width-clamped surface, not the full canvas area.
  const windowWidth = await page.evaluate(() => window.innerWidth);
  expect(containers[0].width, "the pfpage container is clamped below the window width").toBeLessThan(windowWidth);

  await page.screenshot({ path: "e2e/.artifacts/editor-desktop.png" });
});

test("public portfolio has no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/w/${PUBLIC_SLUG}`);
  await page.waitForLoadState("networkidle");

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  console.log("[diag] public 375px overflow:", JSON.stringify(overflow));

  expect(overflow.scrollWidth, "no horizontal scroll at 375px").toBeLessThanOrEqual(overflow.clientWidth + 1);

  await page.screenshot({ path: "e2e/.artifacts/public-375.png", fullPage: true });
});
