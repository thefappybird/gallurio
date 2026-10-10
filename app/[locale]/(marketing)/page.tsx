import type { Metadata } from "next";
import { CheckIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { marketingMetadata, baseUrl } from "@/lib/seo/metadata";
import { buildOrganizationLd, buildWebSiteLd } from "@/lib/seo/marketingJsonLd";
import { safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import NextLink from "next/link";
import { Link } from "@/lib/i18n/navigation";
import { staticFallback } from "@/lib/lemonsqueezy/pricing";
import { buttonVariants } from "@/components/ui/button";
import { AmbientBackground } from "@/components/app/ambient-background";
import type { CSSProperties } from "react";
import { PricingTeaser } from "./_components/pricing-teaser";
import { MarketingReveal } from "./_components/marketing-reveal";
import { VocabularyShowcase } from "./_components/vocabulary-showcase";
import { ThemedShot } from "./_components/themed-shot";

// Static page: no session/DB/headers reads, so Next can serve it from cache.
// Prerendered at build time with the CI env (BETA_TESTER_ENABLED unset there),
// so the first request more than 60s after a deploy regenerates it with the
// runtime env and picks up the flag. The render is cheap (static catalog
// price, no DB/network), so a short window is fine. Meanwhile the client
// fetch of /api/public/pricing corrects the flag and price per visitor.
export const revalidate = 60;

type Props = { params: Promise<{ locale: string }> };

// Stagger index consumed by the `--i` delays in globals.css (MARKETING MOTION).
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.metadata" });
  return marketingMetadata({
    locale,
    path: "/",
    title: t("title"),
    description: t("description"),
  });
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Authenticated visitors never see this static page — proxy.ts redirects
  // them to GET /api/auth/landing before this component ever runs.
  const t = await getTranslations("marketing");
  const tTerms = await getTranslations("marketing.terms");
  const tPrivacy = await getTranslations("marketing.privacy");
  // Server-rendered initial price: static base-tier catalog, no network/DB.
  // The real per-visitor price resolves client-side in PricingTeaser.
  const proPricing = staticFallback("base");

  const trustItems = [t("trust.item1"), t("trust.item2"), t("trust.item3"), t("trust.item4")];

  const builtForItems = [
    t("builtFor.item1"),
    t("builtFor.item2"),
    t("builtFor.item3"),
    t("builtFor.item4"),
    t("builtFor.item5"),
    t("builtFor.item6"),
    t("builtFor.item7"),
    t("builtFor.item8"),
  ];

  const panels = [
    {
      kicker: t("features.portfolioBuilder.title"),
      headline: t("features.portfolioBuilder.panelHeadline"),
      description: t("features.portfolioBuilder.description"),
      features: [
        t("features.portfolioBuilder.feature1"),
        t("features.portfolioBuilder.feature2"),
        t("features.portfolioBuilder.feature3"),
        t("features.portfolioBuilder.feature4"),
      ],
      image: "/marketing/screenshots/portfolio-builder-canvas",
      tone: "card" as const,
      cta: { label: t("features.portfolioBuilder.cta"), href: "/portfolio-maker-demo" as const },
    },
    {
      kicker: t("features.bookingInquiryForms.title"),
      headline: t("features.bookingInquiryForms.panelHeadline"),
      description: t("features.bookingInquiryForms.description"),
      features: [
        t("features.bookingInquiryForms.feature1"),
        t("features.bookingInquiryForms.feature2"),
        t("features.bookingInquiryForms.feature3"),
        t("features.bookingInquiryForms.feature4"),
      ],
      image: "/marketing/screenshots/bookings-calendar",
      tone: "muted" as const,
    },
    {
      kicker: t("features.businessWorkspace.title"),
      headline: t("features.businessWorkspace.panelHeadline"),
      description: t("features.businessWorkspace.description"),
      features: [
        t("features.businessWorkspace.feature1"),
        t("features.businessWorkspace.feature2"),
        t("features.businessWorkspace.feature3"),
        t("features.businessWorkspace.feature4"),
      ],
      image: "/marketing/screenshots/dashboard-overview",
      tone: "brand" as const,
    },
    {
      kicker: t("features.teams.title"),
      headline: t("features.teams.panelHeadline"),
      description: t("features.teams.description"),
      features: [t("features.teams.feature1"), t("features.teams.feature2"), t("features.teams.feature3")],
      image: "/marketing/screenshots/teams-collaboration",
      tone: "card" as const,
    },
  ];

  const transparencyItems = [
    { title: t("transparency.item1.title"), body: t("transparency.item1.body") },
    { title: t("transparency.item2.title"), body: t("transparency.item2.body") },
    { title: t("transparency.item3.title"), body: t("transparency.item3.body") },
    { title: t("transparency.item4.title"), body: t("transparency.item4.body") },
  ];

  // Organization/WebSite are site-wide singletons: use the bare origin, not a
  // locale-prefixed URL, so every locale's Home page emits the same entity
  // (see buildOrganizationLd/buildWebSiteLd). `logo` must be a raster image
  // per Google's structured-data guidance — SVG isn't accepted.
  const organizationLd = buildOrganizationLd({
    url: baseUrl(),
    logoUrl: `${baseUrl()}/brand/gallurio%20sq%20png.png`,
  });
  const webSiteLd = buildWebSiteLd({ url: baseUrl() });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webSiteLd) }} />
      {/* Hero — split down the middle: the public portfolio (Show) vs. the
          business workspace (Manage). Ambient art is confined to the
          headline+trust area so it doesn't compete with the split imagery
          or marquee below. Follows the visitor's site theme, no forced
          override. */}
      <MarketingReveal />
      <section data-r="lines" className="relative bg-background pb-16 text-center text-foreground">
        <div className="relative">
          <div
            className="absolute inset-0"
            style={{
              WebkitMaskImage: "radial-gradient(ellipse 30% 80% at center, transparent 65%, black 100%)",
              maskImage: "radial-gradient(ellipse 30% 80% at center, transparent 65%, black 100%)",
            }}
          >
            {/* Rotated 180deg so the art's denser cluster lands opposite
                the split-hero cards below instead of crowding the header
                and "Manage" card. The rotation is on this inner layer only
                -- the mask above stays unrotated so its center-out fade
                still reads correctly in screen space. Same technique as
                the final CTA's art layer. The ellipse's two size values
                are independent (rx% of width, ry% of height) rather than
                a box-matched default -- the eyebrow-to-microcopy stack is
                much taller relative to its own width than the section box
                is, so rx/ry need different percentages, not one shared
                one, to clear the full stack without widening past it. */}
            <div className="absolute inset-0 rotate-180">
              <AmbientBackground />
            </div>
          </div>
          <div className="relative mx-auto max-w-2xl px-4 pt-14 pb-6 sm:px-6 sm:pt-20">
            <span
              style={{ "--d": "0ms" } as CSSProperties}
              className="mk-hero-in mk-hero-eyebrow mb-6 inline-flex items-center rounded-[var(--radius-sm)] bg-brand px-3.5 py-1.5 text-xs font-bold tracking-wider text-brand-foreground uppercase"
            >
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-balance font-heading text-4xl leading-[0.98] font-extrabold tracking-tighter sm:text-6xl">
              <span className="block overflow-hidden pb-[0.08em]">
                <span className="mk-ln block" style={stagger(0)}>
                  {t("hero.headlineShow")}
                </span>
              </span>
              <span className="block overflow-hidden pb-[0.08em] text-brand">
                <span className="mk-ln block" style={stagger(1)}>
                  {t("hero.headlineRun")}
                </span>
              </span>
            </h1>
            <p
              style={{ "--d": "380ms" } as CSSProperties}
              className="mk-hero-in mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground"
            >
              {t("whatIs.body")}
            </p>
            <div style={{ "--d": "480ms" } as CSSProperties} className="mk-hero-in mt-9 flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className={buttonVariants({ variant: "brand", size: "lg", className: "h-12 px-8 text-base" })}
                >
                  {t("hero.ctaStart")}
                </Link>
                <Link
                  href="/book-demo"
                  className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-8 text-base" })}
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </div>
              <div className="relative z-10 mt-2 flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-2 px-4 text-sm font-semibold text-muted-foreground sm:px-6">
                {trustItems.map((item, i) => (
                  <span
                    key={item}
                    style={stagger(i)}
                    className="mk-trust inline-flex items-center gap-2 text-start sm:whitespace-nowrap"
                  >
                    <CheckIcon className="size-4 shrink-0 text-brand" aria-hidden />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sits below the ambient-art wrapper (which fades out via mask
            before reaching here), so the checklist is always read against
            the plain background — never fighting the line art for
            contrast. Row wraps whenever a locale's translated items don't
            fit the max-width; items themselves stay whitespace-nowrap from
            sm+ up so individual phrases never split mid-word. */}


        <div className="relative z-10 mx-auto mt-16 grid max-w-5xl gap-8 px-4 sm:px-6 md:grid-cols-2 md:gap-0">
          <div data-r="card" style={stagger(0)} className="group relative md:pe-8">
            <div className="mb-4 flex items-center justify-between transition-transform duration-300 group-hover:-translate-y-1">
              <span className="font-heading text-lg font-bold">{t("split.showVerb")}</span>
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t("split.showTag")}
              </span>
            </div>
            <div
              data-testid="marketing-show-image-frame"
              className="relative aspect-[16/11] -rotate-[1.2deg] overflow-hidden rounded-[var(--radius)] ring-1 ring-foreground/10 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[-4px] group-hover:scale-[1.025] group-hover:rotate-0 rtl:rotate-[1.2deg] rtl:group-hover:rotate-0 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            >
              <ThemedShot
                base="/marketing/screenshots/portfolio-builder-canvas"
                alt={t("split.showImageAlt")}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-top"
              />
            </div>
          </div>
          <div data-r="card" style={stagger(1)} className="group relative md:border-s md:border-border md:ps-8">
            <div className="mb-4 flex items-center justify-between transition-transform duration-300 group-hover:-translate-y-1">
              <span className="font-heading text-lg font-bold text-brand">{t("split.manageVerb")}</span>
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t("split.manageTag")}
              </span>
            </div>
            <div
              data-testid="marketing-manage-image-frame"
              className="relative aspect-[16/11] rotate-[1.2deg] overflow-hidden rounded-[var(--radius)] ring-1 ring-foreground/10 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[-4px] group-hover:scale-[1.025] group-hover:rotate-0 rtl:-rotate-[1.2deg] rtl:group-hover:rotate-0 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            >
              <ThemedShot
                base="/marketing/screenshots/dashboard-overview"
                alt={t("split.manageImageAlt")}
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>
        </div>
        <p data-r="soft" className="relative z-10 mx-auto mt-7 max-w-md px-4 text-center text-sm font-semibold text-muted-foreground sm:px-6">
          {t("split.bridgeLead")} <strong className="font-extrabold text-foreground">{t("split.bridgeEmphasis")}</strong>
        </p>

        <div className="relative z-10 mt-10 overflow-hidden border-y border-border py-4">
          <div className="flex w-max animate-marquee-scroll gap-10" aria-hidden="true">
            {[...builtForItems, ...builtForItems].map((item, i) => (
              <span
                key={i}
                className="flex shrink-0 items-center gap-10 text-base font-semibold whitespace-nowrap text-muted-foreground"
              >
                {item}
                <span className="text-brand">—</span>
              </span>
            ))}
          </div>
          <span className="sr-only">{builtForItems.join(", ")}</span>
        </div>
      </section>

      {/* Feature showcase — 4 full-bleed tonal panels, alternating like a
          deck of pages rather than split image/copy rows. Order follows the
          natural narrative: publish -> capture the inquiry -> manage
          everything after -> bring on the team. */}
      {panels.map((panel, index) => (
        <div key={panel.image}>
          <PanelSection panel={panel} index={index} />
          {index === 1 ? <BookingMigrationSection t={t} /> : null}
        </div>
      ))}

      {/* Vocabulary presets — the workspace renames itself to the visitor's trade. */}
      <VocabularyShowcase />

      {/* Transparency — trust/compliance points surfaced as their own block
          (not buried in the footer), directly ahead of pricing. */}
      <section className="border-t border-border bg-foreground px-4 py-16 text-background sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-lg text-start">
            <h2 data-r="rise" className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {t("transparency.title")}
            </h2>
            <p data-r="rise" style={stagger(1)} className="mt-3 text-base leading-7 text-background/70">
              {t("transparency.subtitle")}
            </p>
          </div>
          <div data-r="stamp" className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8">
            {transparencyItems.map((item, i) => (
              <div key={item.title} style={stagger(i)} className="mk-item flex items-start gap-3.5 text-start">
                <span className="mk-badge mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand text-brand-foreground">
                  <CheckIcon className="size-4" aria-hidden />
                </span>
                <p className="text-sm leading-6 text-background/80">
                  <strong className="block font-bold text-background">{item.title}</strong>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <div data-r="soft" className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-background/15 pt-8 text-sm font-semibold">
            <Link href="/terms" className="hover:text-brand">
              {tTerms("title")}
            </Link>
            <Link href="/privacy" className="hover:text-brand">
              {tPrivacy("title")}
            </Link>
            <Link href="/refunds" className="hover:text-brand">
              {t("footer.refundPolicy")}
            </Link>
            <Link href="/contact" className="hover:text-brand">
              {t("footer.contact")}
            </Link>
          </div>
        </div>
      </section>

      {/* Manifesto — the mid-page brand-teal moment. */}
      <section className="border-t border-border bg-brand px-4 py-20 text-center text-brand-foreground sm:px-6 sm:py-28">
        <blockquote
          data-r="words"
          className="mx-auto max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {`“${t("manifesto.quote")}”`.split(/(\s+)/).map((w, i) =>
            /\s/.test(w) ? (
              w
            ) : (
              <span key={i} style={stagger(i / 2)} className="mk-w inline-block max-w-full break-words">
                {w}
              </span>
            ),
          )}
        </blockquote>
        <cite data-r="soft" style={stagger(6)} className="mt-6 block text-sm font-semibold not-italic opacity-85">
          {t("manifesto.attribution")}
        </cite>
      </section>

      <div data-r="rise">
        <PricingTeaser proPricing={proPricing} betaEnabled={process.env.BETA_TESTER_ENABLED === "true"} />
      </div>

      <p data-r="soft" className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
        {t("compareTeaser.intro")}{" "}
        <NextLink href="/compare" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
          {t("compareTeaser.linkLabel")}
        </NextLink>
      </p>

      {/* Final CTA — bookend matching the hero, same theme-following treatment. */}
      <section
        data-r="lines"
        className="relative border-t border-border bg-background px-4 py-20 text-center text-foreground sm:px-6 sm:py-28"
      >
        {/* Same 180deg flip as the hero's art layer, for the same reason:
            keeps the denser cluster off in the corners instead of behind
            the heading/CTA. This section has no trust-strip to separate
            from (unlike the hero), so instead of a top-to-bottom fade it
            gets a center-out fade -- art stays strong at the edges and
            clears out behind the centered text column, regardless of how
            wide the body copy happens to run. Independent rx/ry (not a
            box-matched ellipse) so the safe zone can be tall enough to
            clear the heading-to-microcopy stack without also widening
            past the column's own width. */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: "radial-gradient(ellipse 32% 78% at center, transparent 62%, black 100%)",
            maskImage: "radial-gradient(ellipse 32% 78% at center, transparent 62%, black 100%)",
          }}
        >
          <div className="absolute inset-0 rotate-180">
            <AmbientBackground />
          </div>
        </div>
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
          <h2 className="text-balance font-heading text-3xl font-extrabold tracking-tight sm:text-5xl">
            <span className="block overflow-hidden pb-[0.08em]">
              <span className="mk-ln block">{t("finalCta.title")}</span>
            </span>
          </h2>
          <p data-r="rise" style={stagger(3)} className="max-w-xl text-base leading-7 text-muted-foreground">
            {t("finalCta.body")}
          </p>
          <div data-r="rise" style={stagger(4)} className="flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/sign-up" className={buttonVariants({ variant: "brand", size: "lg", className: "h-12 px-8 text-base" })}>
                {t("finalCta.button")}
              </Link>
              <Link href="/book-demo" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-8 text-base" })}>
                {t("finalCta.ctaSecondary")}
              </Link>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{t("finalCta.microcopy")}</span>
          </div>
        </div>
      </section>
    </>
  );
}

const PANEL_TONE_CLASS = {
  card: "bg-card",
  muted: "bg-muted",
  brand: "",
} as const;

function PanelSection({
  panel,
  index,
}: {
  panel: {
    kicker: string;
    headline: string;
    description: string;
    features: string[];
    image: string;
    tone: "card" | "muted" | "brand";
    cta?: { label: string; href: string };
  };
  index: number;
}) {
  return (
    <section
      style={
        panel.tone === "brand"
          ? { background: "color-mix(in oklch, var(--brand) 10%, var(--background))" }
          : undefined
      }
      className={`border-t border-border px-4 py-16 sm:px-6 sm:py-24 ${PANEL_TONE_CLASS[panel.tone]}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 md:flex-row md:gap-14">
        {index % 2 === 0 ? (
          <>
            <TextBlock panel={panel} />
            <ImageBlock panel={panel} side="wipe-end" />
          </>
        ) : (
          <>
            <ImageBlock panel={panel} side="wipe-start" />
            <TextBlock panel={panel} />
          </>
        )}
      </div>
    </section>
  );
}

function BookingMigrationSection({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const steps = [
    {
      key: "upload",
      image: "/marketing/editorial/import-bookings-step-1",
    },
    {
      key: "normalize",
      image: "/marketing/editorial/import-bookings-step-2",
    },
    {
      key: "preview",
      image: "/marketing/editorial/import-bookings-step-3",
    },
  ] as const;

  return (
    <section className="border-t border-border bg-card px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl text-start">
          <h2
            data-r="rise"
            className="text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t("features.bookingMigration.headline")}
          </h2>
          <p data-r="rise" style={stagger(1)} className="mt-3.5 max-w-xl text-base leading-7 text-muted-foreground">
            {t("features.bookingMigration.description")}
          </p>
        </div>

        <div data-r="steps" className="relative mt-10">
          <span
            aria-hidden
            className="mk-connector absolute inset-x-0 -top-3.5 hidden h-0.5 bg-foreground md:block"
          />
        <ol className="grid gap-8 md:grid-cols-3 md:gap-5">
          {steps.map((step, index) => (
            <li
              key={step.key}
              style={stagger(index)}
              data-testid={`booking-migration-${step.key}-card`}
              className="mk-step group min-w-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:hover:scale-[1.015] motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              <div className="overflow-hidden rounded-[var(--radius-surface)] bg-card ring-1 ring-foreground/10">
                <div
                  data-testid={`booking-migration-${step.key}-header`}
                  className="flex min-h-32 items-start gap-3 border-b border-border px-4 py-5 text-start md:min-h-40"
                >
                  <span className="pt-0.5 text-sm font-bold text-brand tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold tracking-tight">
                      {t(`features.bookingMigration.${step.key}.title`)}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t(`features.bookingMigration.${step.key}.description`)}
                    </p>
                  </div>
                </div>
                <div
                  data-testid={`booking-migration-${step.key}-image`}
                  className="relative aspect-[543/868] w-full overflow-hidden bg-muted"
                >
                  <ThemedShot
                    base={step.image}
                    alt={t(`features.bookingMigration.${step.key}.imageAlt`)}
                    sizes="(min-width: 768px) 33vw, 100vw"
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
        </div>
      </div>
    </section>
  );
}

function TextBlock({
  panel,
}: {
  panel: {
    kicker: string;
    headline: string;
    description: string;
    features: string[];
    cta?: { label: string; href: string };
  };
}) {
  return (
    <div className="flex-1 text-start">
      <p data-r="soft" className="text-sm font-bold tracking-tight text-brand">
        {panel.kicker}
      </p>
      <h3
        data-r="rise"
        style={stagger(1)}
        className="mt-2 text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl"
      >
        {panel.headline}
      </h3>
      <p data-r="rise" style={stagger(2)} className="mt-3.5 max-w-md text-base leading-7 text-muted-foreground">
        {panel.description}
      </p>
      <ul data-r="checks" className="mt-5 flex flex-col gap-2.5">
        {panel.features.map((feature, i) => (
          <li key={feature} style={stagger(i)} className="flex items-start gap-2.5 text-sm font-medium">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      {panel.cta ? (
        <div data-r="soft" className="mt-6">
          <Link href={panel.cta.href} className={buttonVariants({ variant: "brand" })}>
            {panel.cta.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ImageBlock({ panel, side }: { panel: { kicker: string; image: string }; side: "wipe-start" | "wipe-end" }) {
  return (
    <div data-r={side} className="group w-full flex-1">
      <div
        data-testid="marketing-feature-image-frame"
        className="mk-frame relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-surface)] ring-1 ring-foreground/10 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      >
        <ThemedShot
          base={panel.image}
          alt={panel.kicker}
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>
    </div>
  );
}
