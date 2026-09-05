import { type Page, type Locator, expect } from "@playwright/test";

// Shared portfolio-editor drivers reused across batch verification specs.
// The seeded owner has saved drafts, so the entry dialog opens in "returning
// user" mode. Structural specs should load E2E_FIXTURE_DRAFT_NAME rather than a
// design draft — see lib/db/seedE2eDraft.ts for what that fixture guarantees.

/** Open the portfolio editor and load a saved draft by name onto the canvas. */
export async function openEditorWithDraft(page: Page, draftName: string): Promise<void> {
  await page.goto("/portfolio");
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });

  // The entry dialog mounts a beat after the shell hydrates — wait for it.
  const load = page.getByRole("button", { name: /load an existing draft/i });
  await load.waitFor({ state: "visible", timeout: 30_000 });
  await load.click();
  const apply = page.getByRole("button", { name: new RegExp(`^Apply ${draftName}$`, "i") });
  await apply.waitFor({ state: "visible", timeout: 15_000 });
  await apply.click();
  // The editor boots the latest draft as dirty, so switching surfaces an
  // unsaved-changes guard — discard it to load the saved draft cleanly.
  const discard = page.getByRole("button", { name: /^Discard$/ });
  if (await discard.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await discard.click();
  }
  // Entry + drafts dialogs close; canvas reflows.
  await page.getByText("Welcome back").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.getByText("Your drafts").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
}

// ---------------------------------------------------------------------------
// Button paint — real-paint contrast checks
//
// `getComputedStyle(el).color` resolves to an oklab() string in this app, not
// rgb() — a naive rgb() regex silently returns null and any contrast check
// built on it passes vacuously. Rasterize every color through a 1x1 canvas
// instead: it resolves ANY valid CSS color (oklab, color-mix, currentColor)
// to concrete sRGB bytes the way the browser actually paints it.
// ---------------------------------------------------------------------------

export type Rgba = { r: number; g: number; b: number; a: number };

function relativeLuminance({ r, g, b }: Rgba): number {
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two opaque sRGB colors. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ButtonPaint = {
  /** Computed `color` (raw string — oklab()/rgb() — for token-equality asserts). */
  color: string;
  backgroundColor: string;
  borderBottomColor: string;
  /** The first non-transparent ancestor background — the band the button sits on. */
  bandColor: string;
  /** Alpha of the button's OWN background (0 = paints no fill, e.g. link/outline). */
  ownBgAlpha: number;
  labelRgb: Rgba;
  /** The button's own fill composited over its band, or the band itself when the button paints no fill — what the label is actually read against. */
  effectiveRgb: Rgba;
  bandRgb: Rgba;
};

/**
 * Reads a button's real paint: computed color/background/border, the actual
 * backdrop it sits on (walking up ancestors — a button's own background is
 * usually `transparent`), and the effective surface its label is read
 * against (its own fill composited over that backdrop, when it paints one).
 */
export async function readButtonPaint(button: Locator): Promise<ButtonPaint> {
  return button.evaluate((el) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const rasterize = (colorStr: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const compositeOver = (
      fg: { r: number; g: number; b: number; a: number },
      bg: { r: number; g: number; b: number; a: number }
    ) => ({
      r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
      g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
      b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
      a: 1,
    });

    const cs = getComputedStyle(el);
    const color = cs.color;
    const backgroundColor = cs.backgroundColor;
    const borderBottomColor = cs.borderBottomColor;
    const ownBg = rasterize(backgroundColor);

    let node = el.parentElement;
    let bandColor = "rgb(255, 255, 255)";
    let bandRgb = { r: 255, g: 255, b: 255, a: 1 };
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      const rgb = rasterize(bg);
      if (rgb.a > 0.99) {
        bandColor = bg;
        bandRgb = rgb;
        break;
      }
      node = node.parentElement;
    }

    const effectiveRgb = ownBg.a > 0.01 ? compositeOver(ownBg, bandRgb) : bandRgb;
    const labelRgb = rasterize(color);

    return { color, backgroundColor, borderBottomColor, bandColor, ownBgAlpha: ownBg.a, labelRgb, effectiveRgb, bandRgb };
  });
}

/** Publish the currently-loaded draft. Returns the public URL shown in the dialog. */
export async function publishCurrent(page: Page): Promise<string> {
  await page.getByRole("button", { name: /^Publish$/ }).first().click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Publish your portfolio?" });
  await expect(dialog).toBeVisible();
  const url = (await dialog.getByText(/^https?:\/\//).first().innerText()).trim();
  await dialog.getByRole("button", { name: "Publish now" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  return url;
}
