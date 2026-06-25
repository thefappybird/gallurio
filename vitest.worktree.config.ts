/**
 * Temporary vitest config for running tests from within the worktree.
 * The standard vitest.config.ts excludes `.claude/worktrees/**` so that
 * the root project doesn't pick up worktree tests. This config removes
 * that exclude so you can run tests directly from the worktree directory.
 *
 * Usage:
 *   pnpm exec vitest run --config vitest.worktree.config.ts <filter>
 *
 * NOTE: This file is intentionally NOT tracked in git (removed by git rm).
 * It is only needed for local worktree development.
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    reporters: ["default"],
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/*.integration.test.ts",
      // NOTE: .claude/worktrees/** is intentionally NOT excluded here
      // so we can run tests from the worktree root.
    ],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    pool: "forks",
    fileParallelism: false,
    css: false,
  },
  resolve: {
    alias: [
      {
        find: /^@\/lib\/i18n\/navigation$/,
        replacement: path.resolve(__dirname, "test-utils/i18n-navigation-stub.tsx"),
      },
      {
        find: "server-only",
        replacement: path.resolve(__dirname, "test-utils/server-only-shim.ts"),
      },
      {
        find: /^next\/font\/local$/,
        replacement: path.resolve(__dirname, "test-utils/next-font-stub.ts"),
      },
      {
        find: /^next\/cache$/,
        replacement: require.resolve("next/cache"),
      },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
