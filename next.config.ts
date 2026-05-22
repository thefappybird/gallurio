import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://localhost:3000", "weddings-holly-uncertainty-encourage.trycloudflare.com"],
};

export default withNextIntl(nextConfig);
