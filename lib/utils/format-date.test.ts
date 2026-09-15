import { describe, expect, it } from "vitest";

import { stableWeekdayStyle } from "./format-date";

describe("stableWeekdayStyle", () => {
  it.each(["th", "th-TH"])(
    "falls back to narrow for %s, whose short weekday differs between engines",
    (locale) => {
      expect(stableWeekdayStyle(locale)).toBe("narrow");
    }
  );

  it.each(["en", "fil", "id", "ar"])("keeps short for %s", (locale) => {
    expect(stableWeekdayStyle(locale)).toBe("short");
  });
});
