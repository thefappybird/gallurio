import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getEntry, listEntries } from "@/lib/content/entries";
import { renderContent } from "@/lib/content/render";
import { marketingMetadata, localeUrl } from "@/lib/seo/metadata";
import { buildArticleLd, buildBreadcrumbLd } from "@/lib/seo/marketingJsonLd";
import { safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import { Link } from "@/lib/i18n/navigation";
import { buildMdxComponents } from "../../_components/mdx-content";
import { ARTICLE_PROSE_CLASS } from "../../_components/article-prose";
import { formatContentDate } from "../../_components/format-content-date";

type Props = { params: Promise<{ locale: string; slug: string }> };

// English-only content — see compare/[slug]/page.tsx for the same note.
export function generateStaticParams() {
  return listEntries("blog").map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const entry = getEntry("blog", slug);
  if (!entry) return {};

  return marketingMetadata({
    locale,
    path: `/blog/${slug}`,
    title: entry.title,
    description: entry.description,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const entry = getEntry("blog", slug);
  if (!entry) notFound();

  const t = await getTranslations("marketing.blog");
  const url = localeUrl(locale, `/blog/${slug}`);

  const articleLd = buildArticleLd({
    title: entry.title,
    description: entry.description,
    url,
    publishedAt: entry.publishedAt,
    updatedAt: entry.updatedAt,
  });
  const breadcrumbLd = buildBreadcrumbLd([
    { name: t("breadcrumb.home"), url: localeUrl(locale, "/") },
    { name: t("breadcrumb.index"), url: localeUrl(locale, "/blog") },
    { name: entry.title, url },
  ]);

  const content = await renderContent(entry.body, buildMdxComponents());

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/blog" className="hover:text-foreground">
          {t("breadcrumb.index")}
        </Link>
      </nav>

      <h1 className="mt-2 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {entry.title}
      </h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{entry.description}</p>
      <time dateTime={entry.publishedAt} className="mt-2 block text-xs text-muted-foreground">
        {formatContentDate(entry.publishedAt, locale)}
      </time>

      <div className={`${ARTICLE_PROSE_CLASS} mt-10`}>{content}</div>
    </article>
  );
}
