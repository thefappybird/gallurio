import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getEntry, listEntries } from "@/lib/content/entries";
import { renderContent } from "@/lib/content/render";
import { editorialMetadata, localeUrl } from "@/lib/seo/metadata";
import { buildArticleLd, buildBreadcrumbLd } from "@/lib/seo/marketingJsonLd";
import { safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import { buildMdxComponents } from "../../_components/mdx-content";
import { ArticleChrome } from "../../_components/article-chrome";

type Props = { params: Promise<{ locale: string; slug: string }> };

// English-only content. Locale-prefixed requests are redirected by proxy.ts,
// so static params only need the canonical, unprefixed slug.
export function generateStaticParams() {
  return listEntries("blog").map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry("blog", slug);
  if (!entry) return {};

  return editorialMetadata({
    path: `/blog/${slug}`,
    title: entry.title,
    description: entry.description,
    publishedAt: entry.publishedAt,
    updatedAt: entry.updatedAt,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  setRequestLocale("en");

  const entry = getEntry("blog", slug);
  if (!entry) notFound();

  const url = localeUrl("en", `/blog/${slug}`);

  const articleLd = buildArticleLd({
    title: entry.title,
    description: entry.description,
    url,
    publishedAt: entry.publishedAt,
    updatedAt: entry.updatedAt,
  });
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "Home", url: localeUrl("en", "/") },
    { name: "Resources", url: localeUrl("en", "/resources") },
    { name: "Guides", url: localeUrl("en", "/blog") },
    { name: entry.title, url },
  ]);

  const content = await renderContent(entry.body, buildMdxComponents());

  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />

      <ArticleChrome entry={entry}>{content}</ArticleChrome>
    </article>
  );
}
