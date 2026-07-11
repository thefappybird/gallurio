import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Without this, Next.js walks up to the monorepo root (which contains every
  // other git worktree, each with its own full node_modules) because it finds
  // a pnpm-workspace.yaml there too. That makes Turbopack's bundler root — and,
  // per workflow's own docs (monorepo section of with-workflow.mdx, fixed via
  // outputFileTracingRoot below), its directive-discovery watcher — cover the
  // whole monorepo instead of just this worktree: observed as repeated
  // unprompted 14-70s+ "Discovering workflow directives" rescans triggered by
  // file activity in unrelated sibling worktrees, stalling real requests
  // (a ~70s stall on /api/billing/checkout, long enough to blow past a
  // Cloudflare quick tunnel's idle timeout).
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,
  allowedDevOrigins: ["http://localhost:3000", "disabled-vincent-voip-conservation.trycloudflare.com"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
    ],
  },
};

export default withWorkflow(withNextIntl(nextConfig));
