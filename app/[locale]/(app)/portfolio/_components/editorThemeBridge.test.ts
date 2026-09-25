import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Puck 0.22 introduced a semantic token layer (`--puck-color-surface`,
 * `--puck-color-text`, ...) whose members are declared AT `:root` as aliases of
 * the raw palette (`--puck-color-grey-*`, `--puck-color-azure-*`).
 *
 * A custom property resolves where it is DECLARED. Our palette bridge lives on
 * `.gallurio-editor`, far below `:root`, so those aliases resolve against
 * Puck's own palette and completely ignore our overrides — the editor rendered
 * light-only in dark mode on 0.23 for exactly this reason.
 *
 * The fix is to re-declare every such alias inside `.gallurio-editor`, verbatim,
 * so it re-resolves in our scope. This test pins that: if a Puck upgrade adds a
 * new palette-backed alias, it fails here instead of silently painting a panel
 * the wrong colour.
 */
const require_ = createRequire(import.meta.url);

function puckStylesheet(): string {
  const pkg = require_.resolve("@puckeditor/core/package.json");
  return readFileSync(path.join(path.dirname(pkg), "dist", "index.css"), "utf8");
}

/** Every `--puck-*` property Puck defines in terms of a palette variable. */
function paletteBackedAliases(css: string): string[] {
  const re = /(--puck-[a-z0-9-]+)\s*:\s*([^;}]*var\(--puck-color-[^;}]*)/g;
  const names = new Set<string>();
  for (const m of css.matchAll(re)) names.add(m[1]);
  return [...names].sort();
}

/** The raw palette rungs, which are literal values rather than aliases. */
const PALETTE = /^--puck-color-(grey|azure|rose|green|yellow|red)-\d{2}$/;

function editorCss(): string {
  return readFileSync(path.join(__dirname, "editor.css"), "utf8");
}

describe("editor theme bridge", () => {
  it("re-declares every palette-backed Puck alias inside .gallurio-editor", () => {
    const aliases = paletteBackedAliases(puckStylesheet()).filter((n) => !PALETTE.test(n));
    const ours = editorCss();
    const missing = aliases.filter((name) => !ours.includes(`${name}:`));
    expect(missing).toEqual([]);
  });
});
