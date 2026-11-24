import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { getDiscoverPortfolio, listDiscoverPortfolios, type BusinessType } from "@/lib/db/queries/discover";
import { Link } from "@/lib/i18n/navigation";
import { marketingMetadata } from "@/lib/seo/metadata";
import { BUSINESS_TYPE_VALUES } from "@/lib/validators/workspace";
import { cn } from "@/lib/utils";
import { DiscoverGrid } from "./_components/discover-grid";

// Reads the live directory (filters + deep-linked modal come from searchParams).
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[]; q?: string | string[]; p?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.discover.metadata" });
  return marketingMetadata({
    locale,
    path: "/discover",
    title: t("title"),
    description: t("description"),
  });
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function DiscoverPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = await searchParams;

  // Same filter the API accepts: "other" is never a category filter.
  const requested = first(raw.category);
  const category = BUSINESS_TYPE_VALUES.find((v) => v !== "other" && v === requested) as BusinessType | undefined;
  const q = (first(raw.q) ?? "").trim().slice(0, 60);
  const slug = first(raw.p)?.trim();

  const t = await getTranslations("marketing.discover");
  const [{ items, nextCursor }, detail] = await Promise.all([
    listDiscoverPortfolios({ category, q }),
    slug ? getDiscoverPortfolio(slug) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 pb-16 text-start sm:px-6">
      <header>
        <h1 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">{t("headline")}</h1>
        <p className="mt-2.5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="mt-7">
        <DiscoverGrid
          initialItems={items}
          initialCursor={nextCursor}
          initialCategory={category ?? null}
          initialQuery={q}
          initialDetail={detail}
        />
      </div>

      <aside
        aria-labelledby="discover-cta"
        className="mt-14 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[var(--radius-surface)] bg-card p-6 ring-1 ring-foreground/10"
      >
        <div>
          <h2 id="discover-cta" className="text-lg font-bold">
            {t("cta.title")}
          </h2>
          <p className="mt-0.5 max-w-xl text-muted-foreground">{t("cta.body")}</p>
        </div>
        <Link href="/sign-up" className={cn(buttonVariants({ variant: "brand" }), "h-10 px-4 text-sm font-semibold")}>
          {t("cta.button")}
        </Link>
      </aside>
    </div>
  );
}
