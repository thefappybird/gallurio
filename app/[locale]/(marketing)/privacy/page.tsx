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

      <LegalSection title={t("controller.title")}>
        <p>{t("controller.body")}</p>
        <p>
          {t("controller.addressLabel")} {t("controller.address")}
          <br />
          {t("controller.contactLabel")}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>

      <LegalSection title={t("collect.title")}>
        <p>{t("collect.intro")}</p>
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
        <div>
          <h3 className="font-medium text-foreground">{t("collect.emailDelivery.title")}</h3>
          <p className="mt-1">{t("collect.emailDelivery.body")}</p>
        </div>
        <p>{t("collect.outro")}</p>
      </LegalSection>

      <LegalSection title={t("useOfInfo.title")}>
        <p>{t("useOfInfo.intro")}</p>
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
        <p>{t("useOfInfo.outro")}</p>
      </LegalSection>

      <LegalSection title={t("userContentPublic.title")}>
        <p>{t("userContentPublic.body1")}</p>
        <p>{t("userContentPublic.body2")}</p>
      </LegalSection>

      <LegalSection title={t("analytics.title")}>
        <p>{t("analytics.body1")}</p>
        <p>{t("analytics.body2")}</p>
        <p>{t("analytics.body3")}</p>
      </LegalSection>

      <LegalSection title={t("serviceProviders.title")}>
        <p>{t("serviceProviders.intro")}</p>
        <LegalList
          items={[
            t("serviceProviders.item1"),
            t("serviceProviders.item2"),
            t("serviceProviders.item3"),
            t("serviceProviders.item4"),
            t("serviceProviders.item5"),
            t("serviceProviders.item6"),
            t("serviceProviders.item7"),
          ]}
        />
        <p>{t("serviceProviders.outro1")}</p>
        <p>{t("serviceProviders.outro2")}</p>
      </LegalSection>

      <LegalSection title={t("international.title")}>
        <p>{t("international.body1")}</p>
        <p>{t("international.body2")}</p>
      </LegalSection>

      <LegalSection title={t("cookies.title")}>
        <p>{t("cookies.body1")}</p>
        <p>{t("cookies.body2")}</p>
      </LegalSection>

      <LegalSection title={t("retention.title")}>
        <p>{t("retention.body1")}</p>
        <p>{t("retention.body2")}</p>
      </LegalSection>

      <LegalSection title={t("rights.title")}>
        <p>{t("rights.body1")}</p>
        <p>{t("rights.body2")}</p>
        <p>{t("rights.body3")}</p>
      </LegalSection>

      <LegalSection title={t("security.title")}>
        <p>{t("security.body1")}</p>
        <p>{t("security.body2")}</p>
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
