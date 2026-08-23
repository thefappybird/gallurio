import { describe, it, expect } from "vitest";
import { getEntry, listEntries, parseEntry } from "./entries";

const VALID = `---
title: Gallurio vs HoneyBook
description: A booking workspace at a fifth of the price.
publishedAt: 2026-08-18
---

HoneyBook charges per month what Gallurio charges per quarter.
`;

describe("parseEntry()", () => {
  it("splits validated frontmatter from the body", () => {
    const entry = parseEntry("compare", "gallurio-vs-honeybook", VALID);

    expect(entry.title).toBe("Gallurio vs HoneyBook");
    expect(entry.slug).toBe("gallurio-vs-honeybook");
    expect(entry.body).toContain("charges per month");
  });

  it("throws naming the file and the field when frontmatter is malformed", () => {
    const missingDescription = `---
title: Gallurio vs Dubsado
publishedAt: 2026-08-18
---

Body.
`;

    expect(() => parseEntry("compare", "gallurio-vs-dubsado", missingDescription)).toThrow(
      /gallurio-vs-dubsado\.mdx[\s\S]*description/
    );
  });

  it("carries the optional comparison metadata through", () => {
    const withMetadata = `---
title: Gallurio vs Notion
description: A database is not a booking system.
publishedAt: 2026-08-18
updatedAt: 2026-08-20
competitor: Notion
category: record-keeping
bestFor: Teams that need flexible notes
notFor: Teams that need enforced booking records
screenshots:
  - dashboard-overview
  - calendar-month
faq:
  - question: Can Notion send an invoice?
    answer: Not without a third-party integration.
youtubeId: abc123_DEF45
videoTitle: See the booking workflow
videoCaption: A short Gallurio product walkthrough.
---

Body.
`;

    const entry = parseEntry("compare", "gallurio-vs-notion", withMetadata);

    expect(entry.updatedAt).toBe("2026-08-20");
    expect(entry.competitor).toBe("Notion");
    expect(entry.category).toBe("record-keeping");
    expect(entry.bestFor).toBe("Teams that need flexible notes");
    expect(entry.notFor).toBe("Teams that need enforced booking records");
    expect(entry.screenshots).toEqual(["dashboard-overview", "calendar-month"]);
    expect(entry.faq?.[0].question).toBe("Can Notion send an invoice?");
    expect(entry.youtubeId).toBe("abc123_DEF45");
  });
});

describe("listEntries()", () => {
  it("reads the .mdx files on disk", () => {
    expect(listEntries("compare").length).toBeGreaterThan(0);
  });

  it("looks an entry up by slug", () => {
    const first = listEntries("compare")[0];

    expect(getEntry("compare", first.slug)?.title).toBe(first.title);
    expect(getEntry("compare", "no-such-page")).toBeNull();
  });

  it("publishes both Gallurio-first 2026 roundups with live pricing components", () => {
    const crm = getEntry("compare", "best-crm-for-photographers-2026");
    const websites = getEntry("compare", "best-website-builders-for-creatives-2026");

    expect(crm).not.toBeNull();
    expect(crm!.body).toContain("## Gallurio:");
    expect(crm!.body.indexOf("## Gallurio:")).toBeLessThan(crm!.body.indexOf("## HoneyBook:"));
    expect(crm!.body).toContain("<GallurioPrice />");
    expect(crm!.faq?.[0].answer).toMatch(/^Gallurio offers strong value/);

    expect(websites).not.toBeNull();
    expect(websites!.body).toContain("## Gallurio:");
    expect(websites!.body.indexOf("## Gallurio:")).toBeLessThan(websites!.body.indexOf("## Pixieset Website:"));
    expect(websites!.body).toContain("<GallurioPrice />");
    expect(websites!.faq?.[0].answer).toMatch(/^Gallurio offers strong value/);
    expect(websites!.body).toContain("two independent drag-and-drop showcase canvases");
    expect(websites!.body).toContain("creative storefront");
  });

  it("leads every direct comparison search description with Gallurio", () => {
    const directComparisons = listEntries("compare").filter((entry) => entry.competitor);

    expect(directComparisons.length).toBeGreaterThan(0);
    for (const entry of directComparisons) {
      expect(entry.description, entry.slug).toMatch(/^Gallurio\b/);
      expect(entry.body, entry.slug).toMatch(/## The short version\s+\*\*Start with Gallurio\*\*/);
    }
  });

  it("describes the portfolio builder as a creative showcase without claiming ecommerce", () => {
    const entries = [...listEntries("blog"), ...listEntries("compare")];
    const combined = entries.map((entry) => entry.body).join("\n");

    expect(combined).not.toContain("better website builder than Gallurio");
    expect(combined).not.toContain("far better website builder than Gallurio");
    expect(combined).toContain("Home and Gallery");
    expect(combined).toContain("project collections");
    expect(combined).toContain("not an ecommerce checkout");
  });
});
