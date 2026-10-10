import { test } from "@playwright/test";

// Diagnostic probe: records the calendar container's geometry on every
// animation frame from navigation start, plus layout-shift entries with their
// sources, so a late resize can be attributed to the element that caused it.

type Sample = {
  t: number;
  kind: "skeleton" | "calendar" | "none";
  top: number;
  height: number;
  headerBottom: number;
  vh: number;
};

async function installProbe(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __samples: Sample[];
      __shifts: { t: number; value: number; sources: string[] }[];
    };
    type Sample = {
      t: number;
      kind: "skeleton" | "calendar" | "none";
      top: number;
      height: number;
      headerBottom: number;
      vh: number;
    };
    w.__samples = [];
    w.__shifts = [];
    const describe = (n: Node | null | undefined) => {
      if (!n || !(n instanceof Element)) return String(n);
      const cls = typeof n.className === "string" ? n.className.slice(0, 80) : "";
      return `${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""}[${cls}]`;
    };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<
          PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
            sources?: { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
          }
        >) {
          if (e.hadRecentInput) continue;
          w.__shifts.push({
            t: Math.round(e.startTime),
            value: Number(e.value.toFixed(4)),
            sources: (e.sources ?? []).map(
              (s) =>
                `${describe(s.node)} prev(y=${Math.round(s.previousRect.y)},h=${Math.round(
                  s.previousRect.height
                )}) cur(y=${Math.round(s.currentRect.y)},h=${Math.round(s.currentRect.height)})`
            ),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
    const start = performance.now();
    const tick = () => {
      const t = Math.round(performance.now() - start);
      const skel = document.querySelector('[aria-label="Loading calendar"]');
      const cal = document.querySelector(".rbc-calendar")?.parentElement ?? null;
      const el = cal ?? skel;
      const h1 = document.querySelector("h1");
      const r = el?.getBoundingClientRect();
      const s: Sample = {
        t,
        kind: cal ? "calendar" : skel ? "skeleton" : "none",
        top: r ? Math.round(r.top) : -1,
        height: r ? Math.round(r.height) : -1,
        headerBottom: h1 ? Math.round(h1.getBoundingClientRect().bottom) : -1,
        vh: window.innerHeight,
      };
      const last = w.__samples[w.__samples.length - 1];
      if (
        !last ||
        last.kind !== s.kind ||
        last.top !== s.top ||
        last.height !== s.height ||
        last.headerBottom !== s.headerBottom
      ) {
        w.__samples.push(s);
      }
      if (t < 6000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

test.describe("calendar CLS probe", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const path of ["/bookings?view=calendar", "/inquiries?view=calendar"]) {
    test(`probe ${path}`, async ({ page }) => {
      await installProbe(page);
      await page.goto(path);
      await page.locator(".rbc-calendar").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(4_000);
      const data = await page.evaluate(() => {
        const w = window as unknown as { __samples: Sample[]; __shifts: unknown[] };
        return { samples: w.__samples, shifts: w.__shifts };
      });
      console.log(`\n=== ${path} samples ===`);
      for (const s of data.samples) console.log(JSON.stringify(s));
      console.log(`=== ${path} layout shifts ===`);
      for (const s of data.shifts) console.log(JSON.stringify(s));
    });
  }
});
