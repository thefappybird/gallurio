import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Without this, Next.js walks up to the monorepo root (which contains every
  // other git worktree, each with its own full node_modules) because it finds
  // a pnpm-workspace.yaml there too. That makes Turbopack's bundler root cover
  // the whole monorepo instead of just this worktree, dragging in every
  // sibling worktree's node_modules for file scanning.
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,
  allowedDevOrigins: ["http://localhost:3000"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
