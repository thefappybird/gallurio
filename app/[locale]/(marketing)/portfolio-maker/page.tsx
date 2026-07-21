import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.portfolioMaker.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function PortfolioMakerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.portfolioMaker");

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-start sm:px-6 sm:py-20">
      <header>
        <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("header.headline")}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("header.body")}</p>
      </header>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{t("demo.title")}</h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{t("demo.body")}</p>
        <Link
          href="/portfolio-maker-demo"
          className={buttonVariants({ variant: "brand", className: "mt-6" })}
        >
          {t("demo.cta")}
        </Link>
      </section>
    </article>
  );
}
