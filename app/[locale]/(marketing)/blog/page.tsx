import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listEntries, type ContentEntry } from "@/lib/content/entries";
import { marketingMetadata } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/navigation";
import { formatContentDate } from "../_components/format-content-date";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.blog.metadata" });
  return marketingMetadata({
    locale,
    path: "/blog",
    title: t("title"),
    description: t("description"),
  });
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.blog");

  const entries = listEntries("blog").sort((a: ContentEntry, b: ContentEntry) =>
    a.publishedAt < b.publishedAt ? 1 : -1
  );

  return (
    <>
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-start">
          <p className="text-sm font-semibold text-brand">{t("index.eyebrow")}</p>
          <h1 className="mt-2 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("index.headline")}
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{t("index.intro")}</p>
        </div>
      </section>

      <section className="border-t border-border px-4 py-12 sm:px-6">
        <ul className="mx-auto max-w-3xl space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.slug}
              className="rounded-[var(--radius-surface)] p-4 ring-1 ring-foreground/10"
            >
              <Link
                href={`/blog/${entry.slug}`}
                className="font-heading text-base font-semibold hover:text-brand"
              >
                {entry.title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
              <time dateTime={entry.publishedAt} className="mt-2 block text-xs text-muted-foreground">
                {formatContentDate(entry.publishedAt, locale)}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
