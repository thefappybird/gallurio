/**
 * Test stub for `next/font/local`.
 *
 * `next/font/local`'s default export is a build-time macro the Next compiler
 * rewrites; imported directly under Vitest it is `undefined` ("default is not a
 * function"), so any module that registers a font (lib/fonts/portfolio.ts) can't
 * be imported in tests. This stub stands in for the loader and echoes the
 * requested CSS-variable name back, so font-wiring assertions (e.g. the app
 * font resolves to `--font-jakarta`) can run as real runtime tests.
 *
 * Aliased in vitest.config.ts. Production builds use the real loader.
 */
type LocalFontOptions = { variable?: string };

export default function localFontStub(options: LocalFontOptions = {}) {
  const variable = options.variable ?? "--font-stub";
  return {
    variable,
    className: "font-stub",
    style: { fontFamily: variable },
  };
}
