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

test("editor mobile viewport clamps the full canvas frame and remains horizontally reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/portfolio?seoSetup=preview");
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });

  // Every /portfolio visit for an account with existing drafts fires the
  // "Welcome back" entry dialog, which blocks all other interaction.
  const continueEditing = page.getByRole("button", { name: "Continue where you left off" });
  if (await continueEditing.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await continueEditing.click();
  }

  // The first-visit spotlight guide may also be active and its overlay
  // intercepts clicks elsewhere until dismissed.
  const skipGuide = page.getByRole("button", { name: "Skip Guide" });
  if (await skipGuide.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipGuide.click();
    await page.getByRole("button", { name: "Skip Guide" }).click();
  }

  // At 375px the inline canvas controls are hidden and only the compact
  // popover (SlidersHorizontal trigger) renders them — open it first.
  await page.locator('[data-testid="canvas-controls-trigger"]').click();
  // The same controls also render (hidden) in the inline row, so scope to
  // the one actually visible — the just-opened popover's copy.
  await page.locator('button[aria-label="Mobile"]:visible').click();
  await page.waitForFunction(() =>
    document.getElementById("pf-root-canvas-style")?.textContent?.includes("width: 390px !important"),
  );

  const metrics = await page.evaluate(() => {
    const root = document.querySelector("#puck-canvas-root") as HTMLElement | null;
    const preview = document.querySelector("[data-puck-preview]") as HTMLElement | null;
    if (!root || !preview) return null;

    const hasHorizontalScrollOwner = (el: HTMLElement) => {
      let node: HTMLElement | null = el;
      while (node) {
        const style = getComputedStyle(node);
        if (node.scrollWidth > node.clientWidth + 1 && style.overflowX !== "visible" && style.overflowX !== "clip") {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const toolbar = document.querySelector("[data-testid='portfolio-toolbar-scroll']") as HTMLElement | null;
    return {
      rootCssWidth: Math.round(parseFloat(getComputedStyle(root).width)),
      rootWidth: Math.round(root.getBoundingClientRect().width),
      previewWidth: Math.round(preview.getBoundingClientRect().width),
      hasHorizontalScrollOwner: hasHorizontalScrollOwner(root),
      toolbarReachable: toolbar ? hasHorizontalScrollOwner(toolbar) : false,
    };
  });

  console.log("[diag] editor 375px mobile canvas metrics:", JSON.stringify(metrics));
  expect(metrics, "mobile editor canvas metrics").not.toBeNull();
  expect(metrics!.rootCssWidth, "Puck canvas frame follows the mobile viewport width").toBe(390);
  expect(metrics!.rootWidth, "Puck canvas frame includes only its 1px border around the mobile width").toBeLessThanOrEqual(392);
  expect(metrics!.previewWidth, "droppable preview surface follows the mobile viewport width").toBe(390);
  expect(metrics!.hasHorizontalScrollOwner, "canvas overflow remains horizontally scrollable").toBe(true);
  expect(metrics!.toolbarReachable, "toolbar overflow remains horizontally reachable").toBe(true);

  await page.screenshot({ path: "e2e/.artifacts/editor-mobile-375.png" });
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
