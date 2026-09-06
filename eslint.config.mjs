import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees — temporary branches created by background subagents.
    ".claude/worktrees/**",
    // Claude Code hook scripts — plain CommonJS run directly by the harness
    // (package.json has no "type": "module"), not app source.
    ".claude/hooks/**",
  ]),
]);

export default eslintConfig;
