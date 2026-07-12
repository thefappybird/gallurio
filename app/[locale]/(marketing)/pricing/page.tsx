import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

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

  const betaFeatures = [
    t("betaPlan.feature1"),
    t("betaPlan.feature2"),
    t("betaPlan.feature3"),
    t("betaPlan.feature4"),
    t("betaPlan.feature5"),
    t("betaPlan.feature6"),
  ];

  const plannedPlans = [
    {
      key: "studio",
      name: t("studio.name"),
      description: t("studio.description"),
      features: [
        t("studio.feature1"),
        t("studio.feature2"),
        t("studio.feature3"),
        t("studio.feature4"),
        t("studio.feature5"),
        t("studio.feature6"),
      ],
    },
    {
      key: "business",
      name: t("business.name"),
      description: t("business.description"),
      features: [
        t("business.feature1"),
        t("business.feature2"),
        t("business.feature3"),
        t("business.feature4"),
        t("business.feature5"),
        t("business.feature6"),
      ],
    },
  ];

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

      {/* Beta Plan — the one highlighted card */}
      <section className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Card className="ring-2 ring-brand">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{t("betaPlan.name")}</CardTitle>
                <Badge variant="default" className="bg-brand text-brand-foreground">
                  {t("betaPlan.badge")}
                </Badge>
              </div>
              <p className="text-2xl font-semibold tracking-tight">{t("betaPlan.price")}</p>
              <CardDescription>{t("betaPlan.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                {betaFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={buttonVariants({ variant: "brand", size: "lg", className: "mt-6" })}
              >
                {t("betaPlan.cta")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Planned Paid Plans */}
      <section className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-3">
          {plannedPlans.map((plan) => (
            <Card key={plan.key}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Badge variant="outline">{t("plannedBadge")}</Badge>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Billing Notice + Pricing Transparency */}
      <section className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-8 text-start text-sm leading-6 text-muted-foreground">
          <div>
            <p>{t("billingNotice.body1")}</p>
            <p className="mt-3">{t("billingNotice.body2")}</p>
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              {t("pricingTransparency.title")}
            </h2>
            <p className="mt-2">{t("pricingTransparency.body")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
