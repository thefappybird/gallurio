import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { VitestReporter } from "tdd-guard-vitest";

export default defineConfig({
  plugins: [react()],
  test: {
    // `default` keeps normal console output; the tdd-guard reporter writes
    // results to .claude/tdd-guard/data/test.json so the TDD guard hook can read
    // red/green state. projectRoot is pinned to this worktree root.
    reporters: ["default", new VitestReporter({ projectRoot: __dirname })],
    environment: "happy-dom",
    // Real network stylesheet fetches escape `vi.stubGlobal("fetch", ...)`
    // (happy-dom's <link rel=stylesheet> loader uses its own internal fetch,
    // not globalThis.fetch) and can outlive a test's teardown, surfacing as
    // an unhandled-rejection "AbortError" on CI. Disable CSS file loading
    // entirely — no test here asserts on loaded stylesheet contents.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableCSSFileLoading: true,
          // Without this, a disabled load throws synchronously instead of
          // dispatching a `load`/`error` event, which React's stylesheet
          // resource tracking (via `precedence`) surfaces as an unhandled
          // rejection rather than a caught error.
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.claude/worktrees/**"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    pool: "forks",
    // Multiple test files each spin up their own MongoMemoryServer; parallel
    // Mongo starts race on Windows (port + lockdir contention). Serialize.
    fileParallelism: false,
    css: false,
  },
  resolve: {
    alias: [
      {
        // next-intl's createNavigation wrapper tries to import `next/navigation`
        // and Vitest's resolver can't find it (Next 16 exports field quirk).
        // Replace the whole module with a tiny stub for tests.
        find: /^@\/lib\/i18n\/navigation$/,
        replacement: path.resolve(__dirname, "test-utils/i18n-navigation-stub.tsx"),
      },
      {
        find: "server-only",
        replacement: path.resolve(__dirname, "test-utils/server-only-shim.ts"),
      },
      {
        // next/font/local is a build-time macro; imported directly under Vitest
        // its default export is undefined. Stub it so font-registration modules
        // (lib/fonts/portfolio.ts) are importable in tests.
        find: /^next\/font\/local$/,
        replacement: path.resolve(__dirname, "test-utils/next-font-stub.ts"),
      },
      {
        // @workos-inc/authkit-nextjs resolves `next/cache` from its own pnpm
        // subtree where the path differs from the project root's copy. Force
        // vitest to use the project-root next/cache so the import resolves.
        // node_modules lives at the git root, not the worktree directory.
        find: /^next\/cache$/,
        replacement: require.resolve("next/cache"),
      },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
