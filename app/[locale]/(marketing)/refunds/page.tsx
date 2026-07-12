import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  LegalArticle,
  LegalHeader,
  LegalSection,
  LegalList,
} from "../_components/legal-page";

const SUPPORT_EMAIL = "support@gallurio.com";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.refunds.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function RefundsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.refunds");

  return (
    <LegalArticle>
      <LegalHeader title={t("title")} effectiveDate={t("effectiveDate")} />

      <LegalSection title={t("betaPeriod.title")}>
        <p>{t("betaPeriod.body1")}</p>
        <p>{t("betaPeriod.body2")}</p>
      </LegalSection>

      <LegalSection title={t("subscriptions.title")}>
        <p>{t("subscriptions.body1")}</p>
        <p>{t("subscriptions.body2")}</p>
      </LegalSection>

      <LegalSection title={t("refundRequests.title")}>
        <p>{t("refundRequests.intro")}</p>
        <p>{t("refundRequests.approvalIntro")}</p>
        <LegalList
          items={[
            t("refundRequests.item1"),
            t("refundRequests.item2"),
            t("refundRequests.item3"),
            t("refundRequests.item4"),
            t("refundRequests.item5"),
            t("refundRequests.item6"),
            t("refundRequests.item7"),
            t("refundRequests.item8"),
          ]}
        />
        <p>{t("refundRequests.outro")}</p>
      </LegalSection>

      <LegalSection title={t("merchantOfRecord.title")}>
        <p>{t("merchantOfRecord.body1")}</p>
        <p>{t("merchantOfRecord.body2")}</p>
      </LegalSection>

      <LegalSection title={t("nonRefundable.title")}>
        <p>{t("nonRefundable.intro")}</p>
        <LegalList
          items={[
            t("nonRefundable.item1"),
            t("nonRefundable.item2"),
            t("nonRefundable.item3"),
            t("nonRefundable.item4"),
            t("nonRefundable.item5"),
          ]}
        />
        <p>{t("nonRefundable.outro")}</p>
      </LegalSection>

      <LegalSection title={t("howToRequest.title")}>
        <p>
          {t("howToRequest.body")}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p>{t("howToRequest.includeIntro")}</p>
        <LegalList
          items={[
            t("howToRequest.item1"),
            t("howToRequest.item2"),
            t("howToRequest.item3"),
            t("howToRequest.item4"),
            t("howToRequest.item5"),
          ]}
        />
        <p>{t("howToRequest.outro")}</p>
      </LegalSection>

      <LegalSection title={t("cancellations.title")}>
        <p>{t("cancellations.body1")}</p>
        <p>{t("cancellations.body2")}</p>
      </LegalSection>
    </LegalArticle>
  );
}
