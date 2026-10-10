import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Each island lazy-loads its chart. If every island points at its own chart
// file, the bundler emits one async chunk per file and recharts is duplicated
// in each. All islands must share ONE entry module so recharts ships once.
const ISLANDS = [
  "revenue-trend-chart-client.tsx",
  "booking-value-collection-chart-client.tsx",
  "booking-event-type-trend-chart-client.tsx",
  "portfolio-visitors-inquiries-chart-client.tsx",
  "team-performance-cards-client.tsx",
];

describe("dashboard chart islands", () => {
  it.each(ISLANDS)("%s lazy-loads through the shared dashboard-charts module", (file) => {
    const source = readFileSync(join(__dirname, file), "utf8");
    const dynamicImports = [...source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
    expect(dynamicImports).toEqual(["./dashboard-charts"]);
  });
});
