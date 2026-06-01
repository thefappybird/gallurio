import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { workflow } from "@workflow/vitest";
import path from "node:path";

// Separate config for Workflow DevKit integration tests (`*.integration.test.ts`).
// The workflow() plugin compiles "use workflow"/"use step" directives and runs
// the durable runtime in-process. NOTE: vi.mock() does NOT work here — step
// dependencies are bundled by esbuild — so these tests run against real
// in-memory Mongo, never mocked Mongoose.
export default defineConfig({
  plugins: [react(), workflow()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.claude/worktrees/**"],
    testTimeout: 60_000,
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
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
