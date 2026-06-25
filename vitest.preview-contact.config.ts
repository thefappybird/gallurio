import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { VitestReporter } from "tdd-guard-vitest";

// Minimal config for running preview-component tests from within a worktree.
// The main vitest.config.ts excludes **/.claude/worktrees/** (the pattern
// matches against absolute paths), so we need this override when the worktree
// is the CWD.
export default defineConfig({
  plugins: [react()],
  test: {
    reporters: ["verbose", new VitestReporter({ projectRoot: __dirname })],
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: [
      "app/[locale]/portfolio-preview/_components/*.test.{ts,tsx}",
      "app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx",
      "app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx",
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/*.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
    css: false,
  },
  resolve: {
    alias: [
      { find: /^@\/lib\/i18n\/navigation$/, replacement: path.resolve(__dirname, "test-utils/i18n-navigation-stub.tsx") },
      { find: "server-only", replacement: path.resolve(__dirname, "test-utils/server-only-shim.ts") },
      { find: /^next\/font\/local$/, replacement: path.resolve(__dirname, "test-utils/next-font-stub.ts") },
      { find: /^next\/cache$/, replacement: require.resolve("next/cache") },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
