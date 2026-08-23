import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { marketingMetadata } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.appInfo.metadata" });
  return marketingMetadata({
    locale,
    path: "/about",
    title: t("title"),
    description: t("description"),
  });
}

/**
 * A plain-language public explanation of Gallurio for people evaluating the
 * product and for the OAuth consent-screen application homepage.
 */
export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.appInfo");

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-start sm:px-6 sm:py-20">
      <header>
        <p className="text-sm font-semibold text-brand">{t("eyebrow")}</p>
        <h1 className="mt-2 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("headline")}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("intro")}</p>
      </header>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{t("purpose.title")}</h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{t("purpose.body")}</p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{t("googleSignIn.title")}</h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{t("googleSignIn.body")}</p>
      </section>

      <section className="mt-10 border-t border-border pt-8">
        <p className="text-base leading-7 text-muted-foreground">{t("legal.intro")}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <Link href="/privacy" className="text-brand hover:underline">
            {t("legal.privacy")}
          </Link>
          <Link href="/terms" className="text-brand hover:underline">
            {t("legal.terms")}
          </Link>
        </div>
      </section>
    </article>
  );
}
