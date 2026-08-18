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
      /gallurio-vs-dubsado\.mdx.*description/s
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
screenshots:
  - dashboard-overview
  - calendar-month
faq:
  - question: Can Notion send an invoice?
    answer: Not without a third-party integration.
---

Body.
`;

    const entry = parseEntry("compare", "gallurio-vs-notion", withMetadata);

    expect(entry.updatedAt).toBe("2026-08-20");
    expect(entry.competitor).toBe("Notion");
    expect(entry.category).toBe("record-keeping");
    expect(entry.screenshots).toEqual(["dashboard-overview", "calendar-month"]);
    expect(entry.faq?.[0].question).toBe("Can Notion send an invoice?");
  });
});

describe("listEntries()", () => {
  it("reads the .mdx files on disk", () => {
    expect(listEntries("compare").length).toBeGreaterThan(0);
  });
});
