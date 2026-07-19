import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SocialLinks } from "../_components/social-links";

const SUPPORT_EMAIL = "support@gallurio.com";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.contact.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.contact");
  const socialLinks = await SocialLinks();

  const supportTopics = [
    t("supportTopics.item1"),
    t("supportTopics.item2"),
    t("supportTopics.item3"),
    t("supportTopics.item4"),
    t("supportTopics.item5"),
    t("supportTopics.item6"),
    t("supportTopics.item7"),
    t("supportTopics.item8"),
    t("supportTopics.item9"),
  ];

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-start sm:px-6 sm:py-20">
      <header>
        <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("header.headline")}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          {t("header.body")}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {t("supportTopics.title")}
        </h2>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-base leading-7 text-muted-foreground">
          {supportTopics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {t("responseTime.title")}
        </h2>
        <div className="mt-3 space-y-4 text-base leading-7 text-muted-foreground">
          <p>{t("responseTime.body1")}</p>
          <p>{t("responseTime.body2")}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {t("businessInfo.title")}
        </h2>
        <div className="mt-3 space-y-1 text-base leading-7 text-muted-foreground">
          <p>Gallurio</p>
          <p>{t("businessInfo.body")}</p>
          <p>
            {t("businessInfo.emailLabel")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {t("social.title")}
        </h2>
        <div className="mt-3">{socialLinks}</div>
      </section>
    </article>
  );
}
