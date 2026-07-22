import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AmbientBackground } from "@/components/app/ambient-background";
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
  const tManifesto = await getTranslations("marketing.manifesto");

  return (
    <article className="flex flex-1 border-b border-border">
      <div className="flex w-full flex-1 flex-col md:flex-row">
        <section
          data-testid="book-demo-form-pane"
          className="relative flex flex-1 items-start justify-center overflow-hidden px-4 py-10 text-start md:items-center md:py-16"
        >
          <AmbientBackground />
          <div
            data-testid="book-demo-form-card"
            className="relative w-full max-w-sm rounded-[var(--radius-surface)] border border-border bg-card p-8"
          >
            <header>
              <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("header.headline")}
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{t("header.body")}</p>
            </header>

            <div className="mt-10">
              <BookDemoForm />
            </div>
          </div>
        </section>

        <aside
          data-testid="book-demo-accent"
          className="relative flex shrink-0 flex-col gap-6 overflow-hidden border-t border-primary-foreground/20 bg-primary px-4 py-10 text-primary-foreground md:w-[42%] md:min-w-[22rem] md:border-t-0 md:border-s md:px-12 md:py-14"
        >
          <div className="relative flex flex-1 flex-col justify-end gap-6">
            <blockquote>
              <div className="mb-4 h-1 w-16 bg-brand" aria-hidden="true" />
              <p className="max-w-xs text-balance font-heading text-2xl font-bold tracking-tight">
                {tManifesto("quote")}
              </p>
              <footer className="mt-4 text-sm font-semibold text-primary-foreground/70">
                {tManifesto("attribution")}
              </footer>
            </blockquote>
          </div>
        </aside>
      </div>
    </article>
  );
}
