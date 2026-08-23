import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import enRaw from "@/messages/en.json";
import filRaw from "@/messages/fil.json";
import idRaw from "@/messages/id.json";
import arRaw from "@/messages/ar.json";
import thRaw from "@/messages/th.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATALOGS: Record<string, any> = {
  en: enRaw,
  fil: filRaw,
  id: idRaw,
  ar: arRaw,
  th: thRaw,
};

// Zero-count marker phrase — "you can change again anytime" — must appear
// for count=0 so the dialog never claims a lock that won't actually engage
// (design rule: cooldown only starts once >=1 payment is actually restated).
const NO_LOCK_MARKER: Record<string, RegExp> = {
  en: /anytime/i,
  fil: /anumang oras/i,
  id: /kapan saja/i,
  ar: /أي وقت/,
  th: /ทุกเมื่อ/,
};

function makeT(locale: string) {
  return createTranslator({
    locale,
    namespace: "app.settings.workspace",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: CATALOGS[locale] as any,
  }) as unknown as (key: string, vars?: Record<string, unknown>) => string;
}

describe("currency restatement dialog copy — all 5 locales", () => {
  it("renders non-empty, resolved strings for every new key, and the 0-count body never claims a lock", () => {
    for (const locale of Object.keys(CATALOGS)) {
      const t = makeT(locale);

      const title = t("currencyConfirmTitle");
      expect(title, `${locale} currencyConfirmTitle`).not.toBe("currencyConfirmTitle");
      expect(title.length).toBeGreaterThan(0);

      const bodyZero = t("currencyConfirmBody", { count: 0, date: "2026-11-17" });
      expect(bodyZero, `${locale} currencyConfirmBody count=0`).not.toContain("{count");
      expect(bodyZero).toMatch(NO_LOCK_MARKER[locale]);

      const bodyMany = t("currencyConfirmBody", { count: 3, date: "2026-11-17" });
      expect(bodyMany).toContain("3");
      expect(bodyMany).not.toMatch(NO_LOCK_MARKER[locale]);

      expect(t("currencyConfirmConfirm").length).toBeGreaterThan(0);
      expect(t("currencyConfirmCancel").length).toBeGreaterThan(0);

      const locked = t("currencyLockedUntil", { date: "2026-11-17" });
      expect(locked).toContain("2026-11-17");

      const lockedErr = t("currencyChangeLockedError", { date: "2026-11-17" });
      expect(lockedErr).toContain("2026-11-17");

      const rateErr = t("currencyChangeRateError");
      expect(rateErr.length).toBeGreaterThan(0);

      // Replaced warning must mention the 90-day cooldown, not the old
      // "applies to new bookings only" claim.
      expect(t("currencyWarning")).toContain("90");
    }
  });
});
