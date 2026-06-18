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
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: ["**/*.test.{ts,tsx}"],
    // Integration tests need the @workflow/vitest plugin (see
    // vitest.integration.config.ts) — keep them out of the default unit run.
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.claude/worktrees/**",
      "**/*.integration.test.ts",
    ],
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
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
