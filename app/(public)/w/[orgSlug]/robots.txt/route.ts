import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { portfolioBaseDomain, portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import type { PublicPageSeo } from "@/lib/page-builder/types";

// Node runtime: connects to MongoDB (Edge runtime cannot use Mongoose).
export const runtime = "nodejs";
// Published status / noindex can change at any time — never cache stale.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgSlug: string }> };

const HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store",
};

/**
 * Resolves the tenant's own sitemap URL. Uses `new URL()` to construct/
 * validate rather than hand-assembling a host string — the host itself
 * always comes from portfolioPublicUrl/portfolioBaseDomain, never from
 * this route.
 */
function tenantSitemapUrl(slug: string): string {
  if (portfolioBaseDomain()) {
    // Subdomain mode: portfolioPublicUrl(slug) IS the tenant origin (no path).
    const origin = new URL(portfolioPublicUrl(slug)).origin;
    return new URL("/sitemap.xml", origin).toString();
  }
  // Path mode: portfolioPublicUrl(slug) is ".../w/{slug}" — append the segment.
  return new URL(`${portfolioPublicUrl(slug)}/sitemap.xml`).toString();
}

export async function GET(_req: Request, { params }: Params) {
  const { orgSlug } = await params;

  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return new Response(null, { status: 404 });

  const seo = (workspace.publicPage?.seo as PublicPageSeo | undefined) ?? {};
  if (seo.noindex) {
    return new Response("User-agent: *\nDisallow: /\n", { headers: HEADERS });
  }

  // Resolved DB slug (always lowercase), never the raw route param — keeps
  // this in sync with the tenant sitemap route and app/sitemap.ts, both of
  // which use workspace.slug.
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${tenantSitemapUrl(workspace.slug)}`,
    "",
  ].join("\n");

  return new Response(body, { headers: HEADERS });
}
