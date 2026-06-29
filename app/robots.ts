import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/w/",
        disallow: ["/en/", "/fil/", "/ms/", "/id/", "/ar/", "/api/"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
