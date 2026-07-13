import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  LegalArticle,
  LegalHeader,
  LegalIntro,
  LegalSection,
  LegalList,
} from "../_components/legal-page";

const SUPPORT_EMAIL = "support@gallurio.com";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.terms.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.terms");

  return (
    <LegalArticle>
      <LegalHeader title={t("title")} effectiveDate={t("effectiveDate")} />
      <LegalIntro>
        <p>{t("intro1")}</p>
        <p>{t("intro2")}</p>
      </LegalIntro>

      <LegalSection title={t("about.title")}>
        <p>{t("about.body1")}</p>
        <p>{t("about.body2")}</p>
      </LegalSection>

      <LegalSection title={t("eligibility.title")}>
        <p>{t("eligibility.body")}</p>
      </LegalSection>

      <LegalSection title={t("accounts.title")}>
        <p>{t("accounts.body1")}</p>
        <p>{t("accounts.body2")}</p>
      </LegalSection>

      <LegalSection title={t("betaAccess.title")}>
        <p>{t("betaAccess.body1")}</p>
        <p>{t("betaAccess.body2")}</p>
      </LegalSection>

      <LegalSection title={t("userContent.title")}>
        <p>{t("userContent.body1")}</p>
        <p>{t("userContent.body2")}</p>
        <p>{t("userContent.body3")}</p>
      </LegalSection>

      <LegalSection title={t("prohibited.title")}>
        <p>{t("prohibited.intro")}</p>
        <LegalList
          items={[
            t("prohibited.item1"),
            t("prohibited.item2"),
            t("prohibited.item3"),
            t("prohibited.item4"),
            t("prohibited.item5"),
            t("prohibited.item6"),
          ]}
        />
        <p>{t("prohibited.outro")}</p>
      </LegalSection>

      <LegalSection title={t("bookings.title")}>
        <p>{t("bookings.body1")}</p>
        <p>{t("bookings.body2")}</p>
      </LegalSection>

      <LegalSection title={t("subscriptions.title")}>
        <p>{t("subscriptions.body1")}</p>
        <p>{t("subscriptions.body2")}</p>
        <p>{t("subscriptions.body3")}</p>
        <p>{t("subscriptions.body4")}</p>
      </LegalSection>

      <LegalSection title={t("cancellations.title")}>
        <p>{t("cancellations.body1")}</p>
        <p>{t("cancellations.body2")}</p>
      </LegalSection>

      <LegalSection title={t("serviceChanges.title")}>
        <p>{t("serviceChanges.body1")}</p>
        <p>{t("serviceChanges.body2")}</p>
      </LegalSection>

      <LegalSection title={t("ip.title")}>
        <p>{t("ip.body1")}</p>
        <p>{t("ip.body2")}</p>
      </LegalSection>

      <LegalSection title={t("disclaimer.title")}>
        <p>{t("disclaimer.body")}</p>
      </LegalSection>

      <LegalSection title={t("liability.title")}>
        <p>{t("liability.body")}</p>
      </LegalSection>

      <LegalSection title={t("termination.title")}>
        <p>{t("termination.body1")}</p>
        <p>{t("termination.body2")}</p>
      </LegalSection>

      <LegalSection title={t("contact.title")}>
        <p>
          {t("contact.body")}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
