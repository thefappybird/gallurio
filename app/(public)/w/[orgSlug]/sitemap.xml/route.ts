import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { hasRenderableBlocks } from "@/lib/page-builder/normalizePublicPageData";
import { portfolioGalleryUrl, portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import type { PublicPageSeo } from "@/lib/page-builder/types";
import { collectGalleryPublishedImages } from "@/lib/page-builder/seo/publishedImages.server";
import type { PublishedImage } from "@/lib/page-builder/seo/publishedImages";

// Node runtime: connects to MongoDB (Edge runtime cannot use Mongoose).
export const runtime = "nodejs";
// Published status / content can change at any time — never cache stale.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgSlug: string }> };

const HEADERS = {
  "content-type": "application/xml; charset=utf-8",
  "cache-control": "no-store",
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod: Date | null | undefined, images: PublishedImage[] = []): string {
  const lines = ["  <url>", `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`);
  for (const img of images) {
    lines.push("    <image:image>");
    lines.push(`      <image:loc>${xmlEscape(img.url)}</image:loc>`);
    if (img.alt) lines.push(`      <image:caption>${xmlEscape(img.alt)}</image:caption>`);
    lines.push("    </image:image>");
  }
  lines.push("  </url>");
  return lines.join("\n");
}

export async function GET(_req: Request, { params }: Params) {
  const { orgSlug } = await params;

  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return new Response(null, { status: 404 });

  const seo = (workspace.publicPage?.seo as PublicPageSeo | undefined) ?? {};
  if (seo.noindex) return new Response(null, { status: 404 });

  const data = workspace.publicPage?.data as { home?: unknown; gallery?: unknown } | null | undefined;
  const lastmod = workspace.publicPage?.lastPublishedAt ?? null;

  // Use the resolved DB slug (always lowercase), never the raw route param —
  // otherwise a mixed-case request emits <loc> values that disagree with
  // app/sitemap.ts, which lists the lowercase DB slug.
  const entries: string[] = [];
  if (hasRenderableBlocks(data?.home)) entries.push(urlEntry(portfolioPublicUrl(workspace.slug), lastmod));
  if (hasRenderableBlocks(data?.gallery)) {
    const images = await collectGalleryPublishedImages({
      workspaceId: String(workspace._id),
      galleryData: data?.gallery,
    });
    entries.push(urlEntry(portfolioGalleryUrl(workspace.slug), lastmod, images));
  }

  // Neither page renderable: still return a valid (empty) urlset rather than
  // 404 — simpler than special-casing a published-but-contentless workspace,
  // and an empty sitemap is a perfectly valid document.
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    "</urlset>",
  ].join("\n");

  return new Response(body, { headers: HEADERS });
}
