import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { applyVocabulary } from "./apply";
import { VOCABULARY_PRESET_IDS } from "./presets";

const KNOWN = new Set(
  ["inquiry", "booking", "client", "team"].flatMap((w) => [
    `%${w}%`,
    `%${w}s%`,
    `%${w[0].toUpperCase()}${w.slice(1)}%`,
    `%${w[0].toUpperCase()}${w.slice(1)}s%`,
    `%a_${w}%`,
    `%A_${w}%`,
  ]),
);
// plural/irregular forms of the inquiry concept
KNOWN.delete("%inquirys%");
KNOWN.delete("%Inquirys%");
KNOWN.add("%inquiries%");
KNOWN.add("%Inquiries%");

function collect(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (node && typeof node === "object") Object.values(node).forEach((n) => collect(n, out));
  return out;
}

describe("en app catalog vocabulary tokens", () => {
  it("uses only the 24 known token forms", () => {
    const used = collect(en.app).flatMap((s) => s.match(/%[A-Za-z_]+%/g) ?? []);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((t) => !KNOWN.has(t))).toEqual([]);
  });

  it("leaves no token after applying any preset", () => {
    for (const preset of VOCABULARY_PRESET_IDS) {
      const out = collect(applyVocabulary(en as Record<string, unknown>, "en", preset).app);
      expect(out.filter((s) => /%[A-Za-z_]+%/.test(s))).toEqual([]);
    }
  });
});
