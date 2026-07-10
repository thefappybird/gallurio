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
  const t = await getTranslations({ locale, namespace: "marketing.privacy.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.privacy");

  return (
    <LegalArticle>
      <LegalHeader title={t("title")} effectiveDate={t("effectiveDate")} />
      <LegalIntro>
        <p>{t("intro")}</p>
      </LegalIntro>

      <LegalSection title={t("collect.title")}>
        <div>
          <h3 className="font-medium text-foreground">{t("collect.account.title")}</h3>
          <p className="mt-1">{t("collect.account.body")}</p>
        </div>
        <div>
          <h3 className="font-medium text-foreground">{t("collect.business.title")}</h3>
          <p className="mt-1">{t("collect.business.body")}</p>
        </div>
        <div>
          <h3 className="font-medium text-foreground">{t("collect.bookingInquiry.title")}</h3>
          <p className="mt-1">{t("collect.bookingInquiry.body")}</p>
        </div>
        <div>
          <h3 className="font-medium text-foreground">{t("collect.usage.title")}</h3>
          <p className="mt-1">{t("collect.usage.body")}</p>
        </div>
        <div>
          <h3 className="font-medium text-foreground">{t("collect.payment.title")}</h3>
          <p className="mt-1">{t("collect.payment.body")}</p>
        </div>
      </LegalSection>

      <LegalSection title={t("useOfInfo.title")}>
        <LegalList
          items={[
            t("useOfInfo.item1"),
            t("useOfInfo.item2"),
            t("useOfInfo.item3"),
            t("useOfInfo.item4"),
            t("useOfInfo.item5"),
            t("useOfInfo.item6"),
            t("useOfInfo.item7"),
            t("useOfInfo.item8"),
            t("useOfInfo.item9"),
          ]}
        />
      </LegalSection>

      <LegalSection title={t("userContentPublic.title")}>
        <p>{t("userContentPublic.body1")}</p>
        <p>{t("userContentPublic.body2")}</p>
      </LegalSection>

      <LegalSection title={t("sharing.title")}>
        <p>{t("sharing.body1")}</p>
        <p>{t("sharing.body2")}</p>
        <p>{t("sharing.body3")}</p>
      </LegalSection>

      <LegalSection title={t("security.title")}>
        <p>{t("security.body1")}</p>
        <p>{t("security.body2")}</p>
      </LegalSection>

      <LegalSection title={t("retention.title")}>
        <p>{t("retention.body1")}</p>
        <p>{t("retention.body2")}</p>
      </LegalSection>

      <LegalSection title={t("cookies.title")}>
        <p>{t("cookies.body1")}</p>
        <p>{t("cookies.body2")}</p>
      </LegalSection>

      <LegalSection title={t("international.title")}>
        <p>{t("international.body1")}</p>
        <p>{t("international.body2")}</p>
      </LegalSection>

      <LegalSection title={t("children.title")}>
        <p>{t("children.body1")}</p>
        <p>{t("children.body2")}</p>
      </LegalSection>

      <LegalSection title={t("changes.title")}>
        <p>{t("changes.body")}</p>
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
