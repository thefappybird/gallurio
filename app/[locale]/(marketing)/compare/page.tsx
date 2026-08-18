import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listEntries, type ContentEntry } from "@/lib/content/entries";
import { marketingMetadata } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

// Fixed display order for the /compare index groups — matches the
// `category` values authored in content/compare/*.mdx frontmatter.
const CATEGORY_ORDER = [
  "crm",
  "website-builder",
  "gallery-delivery",
  "record-keeping",
  "intake",
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.compare.metadata" });
  return marketingMetadata({
    locale,
    path: "/compare",
    title: t("title"),
    description: t("description"),
  });
}

export default async function CompareIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.compare");

  const entries = listEntries("compare");
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    entries: entries
      .filter((entry) => entry.category === category)
      .sort((a: ContentEntry, b: ContentEntry) => (a.publishedAt < b.publishedAt ? 1 : -1)),
  })).filter((group) => group.entries.length > 0);

  return (
    <>
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-start">
          <p className="text-sm font-semibold text-brand">{t("index.eyebrow")}</p>
          <h1 className="mt-2 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("index.headline")}
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{t("index.intro1")}</p>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{t("index.intro2")}</p>
        </div>
      </section>

      <section className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-10">
          {groups.map((group) => (
            <div key={group.category}>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {t(`categories.${group.category}`)}
              </h2>
              <ul className="mt-4 space-y-4">
                {group.entries.map((entry) => (
                  <li
                    key={entry.slug}
                    className="rounded-[var(--radius-surface)] p-4 ring-1 ring-foreground/10"
                  >
                    <Link
                      href={`/compare/${entry.slug}`}
                      className="font-heading text-base font-semibold hover:text-brand"
                    >
                      {entry.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
