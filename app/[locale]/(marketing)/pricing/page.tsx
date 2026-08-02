import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const SUPPORT_EMAIL = "support@gallurio.com";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.pricing.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("marketing.pricing");
  const proPricing = await getProPricing();

  const proFeatures = [
    t("pro.feature1"),
    t("pro.feature2"),
    t("pro.feature3"),
    t("pro.feature4"),
    t("pro.feature5"),
    t("pro.feature6"),
  ];

  const monthlyPrice = formatMoney(proPricing.monthly, proPricing.currency, locale);
  const yearlyPrice = formatMoney(proPricing.yearly, proPricing.currency, locale);

  return (
    <>
      {/* Header */}
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-start">
          <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("header.headline")}
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{t("header.body")}</p>
        </div>
      </section>

      {/* Pro Plan */}
      <section className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Card className="ring-2 ring-brand">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{t("pro.name")}</CardTitle>
                <Badge variant="default" className="bg-brand text-brand-foreground">
                  {t("pro.badge")}
                </Badge>
              </div>
              <p className="text-sm font-semibold text-brand">{t("pro.freeMonth")}</p>
              <p className="text-2xl font-semibold tracking-tight">
                {monthlyPrice}
                <span className="ms-1 text-sm font-normal text-muted-foreground">
                  {t("pro.priceSuffixMonthly")}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {t("pro.yearlyNote", { price: yearlyPrice })}
              </p>
              <CardDescription>{t("pro.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                {proFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={buttonVariants({ variant: "brand", size: "lg", className: "mt-6" })}
              >
                {t("pro.cta")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Billing Notice + Pricing Transparency */}
      <section className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-8 text-start text-sm leading-6 text-muted-foreground">
          <div>
            <p>{t("billingNotice.body1")}</p>
            <p className="mt-3">{t("billingNotice.body2")}</p>
            <p className="mt-3">{t("billingNotice.body3")}</p>
            <p className="mt-3">{t("billingNotice.body4")}</p>
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              {t("pricingTransparency.title")}
            </h2>
            <p className="mt-2">{t("pricingTransparency.body1")}</p>
            <p className="mt-2">{t("pricingTransparency.body2")}</p>
          </div>
          <p>
            {t("contactNote.body")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
