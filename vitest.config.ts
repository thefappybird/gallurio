import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
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
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
