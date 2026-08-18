import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { marketingMetadata, localeUrl } from "@/lib/seo/metadata";
import { buildSoftwareApplicationLd } from "@/lib/seo/marketingJsonLd";
import { safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import { PricingPlans } from "./_plans";

const SUPPORT_EMAIL = "support@gallurio.com";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.pricing.metadata" });
  return marketingMetadata({
    locale,
    path: "/pricing",
    title: t("title"),
    description: t("description"),
  });
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("marketing.pricing");
  // getDisplayPricing() reads CF-IPCountry, so this route renders per request
  // instead of prerendering. That is deliberate: the image is built without the
  // LEMONSQUEEZY_VARIANT_* env (only NEXT_PUBLIC_* reach the Docker build), so a
  // prerendered page baked getProPricing()'s static PLAN_CATALOG fallback into
  // the HTML and served a hardcoded price until the next release. Rendering per
  // request is what makes this page agree with the live Lemon Squeezy price.
  const proPricing = await getDisplayPricing();
  const betaEnabled = process.env.BETA_TESTER_ENABLED === "true";

  const softwareApplicationLd = buildSoftwareApplicationLd({
    price: proPricing.monthly,
    currency: proPricing.currency,
    url: localeUrl(locale, "/pricing"),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(softwareApplicationLd) }}
      />
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
          <PricingPlans proPricing={proPricing} betaEnabled={betaEnabled} />
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
