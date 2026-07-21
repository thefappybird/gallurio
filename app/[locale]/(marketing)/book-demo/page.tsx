import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookDemoForm } from "./_components/BookDemoForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.bookDemo.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function BookDemoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.bookDemo");

  return (
    <article className="mx-auto max-w-xl px-4 py-16 text-start sm:px-6 sm:py-20">
      <header>
        <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("header.headline")}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("header.body")}</p>
      </header>

      <div className="mt-10">
        <BookDemoForm />
      </div>
    </article>
  );
}
