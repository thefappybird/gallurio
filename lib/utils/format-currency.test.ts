import { describe, expect, it } from "vitest";
import { formatMoney } from "./format-currency";

describe("formatMoney", () => {
  it("formats PHP without fractional digits", () => {
    expect(formatMoney(24850, "PHP", "en")).toMatch(/24,850/);
    expect(formatMoney(24850, "PHP", "en")).not.toMatch(/\.\d/);
  });

  it("uses the currency's native symbol per locale", () => {
    expect(formatMoney(1000, "USD", "en")).toMatch(/\$/);
    expect(formatMoney(1000, "GBP", "en")).toMatch(/£/);
    expect(formatMoney(1000, "PHP", "en")).toMatch(/₱|PHP/);
  });

  it("rounds to whole units", () => {
    expect(formatMoney(99.4, "PHP", "en")).toMatch(/99/);
    expect(formatMoney(99.6, "PHP", "en")).toMatch(/100/);
  });

  it("handles zero and negative values", () => {
    expect(formatMoney(0, "PHP", "en")).toMatch(/0/);
    const negative = formatMoney(-500, "PHP", "en");
    expect(negative).toMatch(/500/);
    expect(negative).toMatch(/-|−|\(/);
  });

  it("respects locale-specific grouping", () => {
    expect(formatMoney(1_000_000, "USD", "en")).toMatch(/1,000,000/);
  });
});
