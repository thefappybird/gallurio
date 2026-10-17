import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";
import id from "@/messages/id.json";
import ar from "@/messages/ar.json";
import th from "@/messages/th.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATALOGS: Record<string, any> = { en, fil, id, ar, th };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const importNs = (m: any) => m.app.bookings.import;

describe.each(Object.keys(CATALOGS))("import copy (%s)", (locale) => {
  it("nav.resultsReady is an ICU plural on {count}", () => {
    const raw: string = importNs(CATALOGS[locale]).nav.resultsReady;
    expect(raw).toMatch(/\{count, plural,/);
    expect(raw).toMatch(/other \{/);
  });

  it("nav.resultsReady formats a number into the sentence", () => {
    const t = createTranslator({
      locale,
      messages: CATALOGS[locale],
      namespace: "app.bookings.import.nav",
    });
    expect(t("resultsReady", { count: 5 })).toContain("5");
    expect(t("resultsReady", { count: 1 })).toBeTruthy();
  });

  it("announces terminal import states for the status dot", () => {
    const t = createTranslator({
      locale,
      messages: CATALOGS[locale],
      namespace: "app.bookings.import.nav",
    });
    expect(t("completed")).toBeTruthy();
    expect(t("failed")).toBeTruthy();
    expect(t("completed")).not.toBe(t("failed"));
  });

  it("uses term placeholders, not hardcoded client/booking/team words", () => {
    const m = importNs(CATALOGS[locale]);
    const raw: string[] = [
      m.missingClientName,
      m.results.bookingNotFound,
      m.results.clientNotFound,
    ];
    for (const s of raw) expect(s).toMatch(/%(client|booking)%/i);
    if (locale === "en") {
      for (const s of raw) expect(s.replace(/%\w+%/g, "")).not.toMatch(/\b(client|booking)\b/i);
    }
  });
});

describe("notification import bodies", () => {
  it("ar import bodies use %team%, not a hardcoded team word", () => {
    const text = JSON.stringify(ar);
    const bodies = text.match(/"body":"[^"]*(?:الاستيراد لـ|الاستيراد لفريقك)[^"]*"/g) ?? [];
    expect(bodies.length).toBeGreaterThanOrEqual(3);
    for (const b of bodies) {
      expect(b).toContain("%team%");
      expect(b).not.toContain("فريقك");
    }
  });
});
