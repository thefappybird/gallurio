import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { appFontVariable, portfolioFontVariables } from "./portfolio";

// next/font/local is stubbed under Vitest (test-utils/next-font-stub.ts +
// vitest.config alias) so this module imports; the stub echoes each registered
// `variable`, letting us assert the real app-font wiring at runtime.
describe("app-shell font (Plus Jakarta Sans)", () => {
  it("bundles the woff2 and exposes it as the app font variable", () => {
    // Self-hosted asset present (offline-reproducible build, like the others).
    expect(
      existsSync(
        resolve(__dirname, "../../app/fonts/plus-jakarta-sans-latin-wght-normal.woff2"),
      ),
    ).toBe(true);

    // The app-shell font variable resolves to Plus Jakarta Sans' CSS var.
    expect(appFontVariable).toBe("--font-jakarta");

    // …and it rides on portfolioFontVariables so it resolves on the app root.
    expect(portfolioFontVariables).toContain("--font-jakarta");
  });
});
