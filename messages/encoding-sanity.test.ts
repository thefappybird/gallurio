import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = join(__dirname);
const MOJIBAKE_PATTERNS = [/Â/, /â€/, /Ã¢/, /Ã©/, /ï»¿/];

function localeFiles(): string[] {
  return readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));
}

describe("message catalog encoding sanity", () => {
  it("contains no double-encoded UTF-8 (mojibake) sequences", () => {
    for (const file of localeFiles()) {
      const raw = readFileSync(join(MESSAGES_DIR, file), "utf8");
      for (const pattern of MOJIBAKE_PATTERNS) {
        expect(pattern.test(raw), `${file} matched mojibake pattern ${pattern}`).toBe(false);
      }
    }
  });

  it("has no leading byte-order mark", () => {
    for (const file of localeFiles()) {
      const raw = readFileSync(join(MESSAGES_DIR, file), "utf8");
      expect(raw.charCodeAt(0), `${file} starts with a BOM`).not.toBe(0xfeff);
    }
  });
});
