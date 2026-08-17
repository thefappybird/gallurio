import type { Metadata } from "next";
import { CheckIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/lib/i18n/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { defaultPostAuthPath } from "@/lib/auth/postAuthLanding";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { buttonVariants } from "@/components/ui/button";
import { AmbientBackground } from "@/components/app/ambient-background";
import { PricingTeaser } from "./_components/pricing-teaser";
import { ThemedShot } from "./_components/themed-shot";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.metadata" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Authenticated visitors never see the landing page — send them to their
  // first accessible surface (owner -> dashboard, staff/team member -> bookings,
  // no workspace yet -> onboarding). Mirrors the post-sign-in redirect.
  const authUser = await getAuthUser();
  if (authUser) {
    await connectDB();
    const user = await User.findOne({ workosUserId: authUser.workosUserId })
      .select("memberships onboardingCompletedAt")
      .lean();
    // A missing User doc is effectively "no memberships" -> onboarding.
    redirect(defaultPostAuthPath(user ?? { memberships: [] }, locale));
  }

  const t = await getTranslations("marketing");
  const tTerms = await getTranslations("marketing.terms");
  const tPrivacy = await getTranslations("marketing.privacy");
  const proPricing = await getDisplayPricing();

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

  return (
    <>
      {/* Hero — split down the middle: the public portfolio (Show) vs. the
          business workspace (Manage). Ambient art is confined to the
          headline+trust area so it doesn't compete with the split imagery
          or marquee below. Follows the visitor's site theme, no forced
          override. */}
      <section className="relative bg-background pb-16 text-center text-foreground">
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
            <span className="mb-6 inline-flex items-center rounded-[var(--radius-sm)] bg-brand px-3.5 py-1.5 text-xs font-bold tracking-wider text-brand-foreground uppercase">
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-balance font-heading text-4xl leading-[0.98] font-extrabold tracking-tighter sm:text-6xl">
              <span className="block">{t("hero.headlineShow")}</span>
              <span className="block text-brand">{t("hero.headlineRun")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{t("whatIs.body")}</p>
            <div className="mt-9 flex flex-col items-center gap-3">
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
              <div className="relative z-10 mt-2 flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-2 px-4 text-sm font-semibold text-muted-foreground sm:flex-nowrap sm:px-6">
                {trustItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 whitespace-nowrap">
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
            contrast. flex-nowrap + a wide max-width keeps it one row from
            sm+ up; only true mobile widths wrap it. */}                                                              


        <div className="relative z-10 mx-auto mt-16 grid max-w-5xl gap-8 px-4 sm:px-6 md:grid-cols-2 md:gap-0">
          <div className="group relative md:pe-8">
            <div className="mb-4 flex items-center justify-between transition-transform duration-300 group-hover:-translate-y-1">
              <span className="font-heading text-lg font-bold">{t("split.showVerb")}</span>
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t("split.showTag")}
              </span>
            </div>
            <div className="relative aspect-[16/11] -rotate-[1.2deg] overflow-hidden rounded-[var(--radius)] ring-1 ring-foreground/10 transition-transform duration-300 group-hover:translate-y-[-4px] group-hover:rotate-0 rtl:rotate-[1.2deg] rtl:group-hover:rotate-0">
              <ThemedShot
                base="/marketing/screenshots/portfolio-builder-canvas"
                alt={t("split.showImageAlt")}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-top"
              />
            </div>
          </div>
          <div className="group relative md:border-s md:border-border md:ps-8">
            <div className="mb-4 flex items-center justify-between transition-transform duration-300 group-hover:-translate-y-1">
              <span className="font-heading text-lg font-bold text-brand">{t("split.manageVerb")}</span>
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {t("split.manageTag")}
              </span>
            </div>
            <div className="relative aspect-[16/11] rotate-[1.2deg] overflow-hidden rounded-[var(--radius)] ring-1 ring-foreground/10 transition-transform duration-300 group-hover:translate-y-[-4px] group-hover:rotate-0 rtl:-rotate-[1.2deg] rtl:group-hover:rotate-0">
              <ThemedShot
                base="/marketing/screenshots/dashboard-overview"
                alt={t("split.manageImageAlt")}
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>
        </div>
        <p className="relative z-10 mx-auto mt-7 max-w-md px-4 text-center text-sm font-semibold text-muted-foreground sm:px-6">
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
        <PanelSection key={panel.image} panel={panel} index={index} />
      ))}

      {/* Transparency — trust/compliance points surfaced as their own block
          (not buried in the footer), directly ahead of pricing. */}
      <section className="border-t border-border bg-foreground px-4 py-16 text-background sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-lg text-start">
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{t("transparency.title")}</h2>
            <p className="mt-3 text-base leading-7 text-background/70">{t("transparency.subtitle")}</p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8">
            {transparencyItems.map((item) => (
              <div key={item.title} className="flex items-start gap-3.5 text-start">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand text-brand-foreground">
                  <CheckIcon className="size-4" aria-hidden />
                </span>
                <p className="text-sm leading-6 text-background/80">
                  <strong className="block font-bold text-background">{item.title}</strong>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-background/15 pt-8 text-sm font-semibold">
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
        <blockquote className="mx-auto max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          &ldquo;{t("manifesto.quote")}&rdquo;
        </blockquote>
        <cite className="mt-6 block text-sm font-semibold not-italic opacity-85">
          {t("manifesto.attribution")}
        </cite>
      </section>

      <PricingTeaser proPricing={proPricing} />

      {/* Final CTA — bookend matching the hero, same theme-following treatment. */}
      <section className="relative border-t border-border bg-background px-4 py-20 text-center text-foreground sm:px-6 sm:py-28">
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
            {t("finalCta.title")}
          </h2>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">{t("finalCta.body")}</p>
          <div className="flex flex-col items-center gap-3">
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
            <ImageBlock panel={panel} />
          </>
        ) : (
          <>
            <ImageBlock panel={panel} />
            <TextBlock panel={panel} />
          </>
        )}
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
      <p className="text-sm font-bold tracking-tight text-brand">{panel.kicker}</p>
      <h3 className="mt-2 text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        {panel.headline}
      </h3>
      <p className="mt-3.5 max-w-md text-base leading-7 text-muted-foreground">{panel.description}</p>
      <ul className="mt-5 flex flex-col gap-2.5">
        {panel.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm font-medium">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      {panel.cta ? (
        <Link href={panel.cta.href} className={buttonVariants({ variant: "brand", className: "mt-6" })}>
          {panel.cta.label}
        </Link>
      ) : null}
    </div>
  );
}

function ImageBlock({ panel }: { panel: { kicker: string; image: string } }) {
  return (
    <div className="w-full flex-1">
      <div
        data-hover="brighten"
        className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-surface)] ring-1 ring-foreground/10"
      >
        <ThemedShot base={panel.image} alt={panel.kicker} sizes="(min-width: 768px) 50vw, 100vw" />
      </div>
    </div>
  );
}
