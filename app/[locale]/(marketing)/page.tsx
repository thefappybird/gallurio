import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/lib/i18n/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { defaultPostAuthPath } from "@/lib/auth/postAuthLanding";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { buttonVariants } from "@/components/ui/button";
import { MotionObserver } from "@/lib/page-builder/MotionObserver.client";
import { PricingTeaser } from "./_components/pricing-teaser";

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

  const builtForItems = [
    t("builtFor.item1"),
    t("builtFor.item2"),
    t("builtFor.item3"),
    t("builtFor.item4"),
    t("builtFor.item5"),
    t("builtFor.item6"),
    t("builtFor.item7"),
  ];

  const panels = [
    {
      index: t("features.portfolioBuilder.title"),
      headline: t("features.portfolioBuilder.panelHeadline"),
      description: t("features.portfolioBuilder.description"),
      image: "/marketing/screenshots/portfolio-builder-canvas.png",
      tone: "card" as const,
    },
    {
      index: t("features.businessWorkspace.title"),
      headline: t("features.businessWorkspace.panelHeadline"),
      description: t("features.businessWorkspace.description"),
      image: "/marketing/screenshots/dashboard-overview.png",
      tone: "muted" as const,
    },
    {
      index: t("features.bookingInquiryForms.title"),
      headline: t("features.bookingInquiryForms.panelHeadline"),
      description: t("features.bookingInquiryForms.description"),
      image: "/marketing/screenshots/bookings-calendar.png",
      tone: "brand" as const,
    },
  ];

  return (
    <>
      <MotionObserver />

      {/* Hero — the one full "committed" dark moment at the top of the page,
          reusing the app's own dark theme tokens (scoped via the `dark`
          class), not a second palette. The breakout screenshot bleeds into
          the light section below via negative margin. */}
      <section className="dark relative bg-background pt-20 pb-40 text-center text-foreground sm:pt-28">
        <div className="mx-auto max-w-2xl px-4 sm:px-6" data-anim="slide-up">
          <h1 className="text-balance font-heading text-4xl font-extrabold tracking-tighter sm:text-6xl">
            {t("hero.headline")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            {t("hero.body")}
          </p>
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: "brand", size: "lg", className: "mt-9 h-12 px-8 text-base" })}
          >
            {t("hero.ctaJoinBeta")}
          </Link>
        </div>

        <div
          className="relative z-10 mx-auto -mb-36 mt-14 max-w-5xl px-4 sm:px-6"
          data-anim="zoom"
          style={{ transitionDelay: "80ms" }}
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-surface)] shadow-2xl shadow-black/40">
            <Image
              src="/marketing/screenshots/portfolio-builder-canvas.png"
              alt={t("features.portfolioBuilder.title")}
              fill
              sizes="(min-width: 80rem) 64rem, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* What is Gallurio? + Built for — merged two-column, light ground.
          Top padding absorbs the hero's breakout image. */}
      <section className="px-4 pt-48 pb-16 sm:px-6 sm:pt-56 sm:pb-20">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 sm:gap-16" data-anim="slide-up">
          <div className="text-start">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">{t("whatIs.title")}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{t("whatIs.body")}</p>
          </div>
          <div className="text-start">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">{t("builtFor.title")}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {builtForItems.map((item) => (
                <span
                  key={item}
                  className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature showcase — 3 full-bleed tonal panels, alternating like a
          deck of pages rather than split image/copy rows. */}
      {panels.map((panel, index) => (
        <PanelSection key={panel.image} panel={panel} index={index} />
      ))}

      {/* Lighter supporting pair — text only, no screenshots. */}
      <section
        data-anim="slide-up"
        className="border-t border-border px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2">
          <div className="text-start">
            <h3 className="font-heading text-lg font-semibold">{t("features.customBranding.title")}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("features.customBranding.description")}
            </p>
          </div>
          <div className="text-start">
            <h3 className="font-heading text-lg font-semibold">{t("features.clientReadyPages.title")}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("features.clientReadyPages.description")}
            </p>
          </div>
        </div>
      </section>

      {/* Manifesto — the mid-page brand-teal moment. */}
      <section
        data-anim="slide-up"
        className="border-t border-border bg-brand px-4 py-20 text-center text-brand-foreground sm:px-6 sm:py-28"
      >
        <blockquote className="mx-auto max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          &ldquo;{t("manifesto.quote")}&rdquo;
        </blockquote>
        <cite className="mt-6 block text-sm font-semibold not-italic opacity-85">
          {t("manifesto.attribution")}
        </cite>
      </section>

      <PricingTeaser />

      {/* Beta Notice — plain text, quiet tone. */}
      <section data-anim="slide-up" className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl text-start text-sm leading-6 text-muted-foreground">
          <p>{t("betaNotice.body1")}</p>
          <p className="mt-3">{t("betaNotice.body2")}</p>
        </div>
      </section>

      {/* Final CTA — dark bookend, matching the hero. */}
      <section data-anim="slide-up" className="dark border-t border-border bg-background px-4 py-20 text-center text-foreground sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
          <h2 className="text-balance font-heading text-3xl font-extrabold tracking-tight sm:text-5xl">
            {t("finalCta.title")}
          </h2>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">{t("finalCta.subtitle")}</p>
          <Link href="/sign-up" className={buttonVariants({ variant: "brand", size: "lg", className: "h-12 px-8 text-base" })}>
            {t("finalCta.button")}
          </Link>
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
  panel: { index: string; headline: string; description: string; image: string; tone: "card" | "muted" | "brand" };
  index: number;
}) {
  return (
    <section
      data-anim="slide-up"
      style={{
        transitionDelay: `${index * 60}ms`,
        ...(panel.tone === "brand"
          ? { background: "color-mix(in oklch, var(--brand) 10%, var(--background))" }
          : undefined),
      }}
      className={`border-t border-border px-4 py-16 sm:px-6 sm:py-24 ${PANEL_TONE_CLASS[panel.tone]}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 md:flex-row md:gap-14">
        <div className="flex-1 text-start">
          <p className="text-sm font-bold tracking-tight text-brand">{panel.index}</p>
          <h3 className="mt-2 text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {panel.headline}
          </h3>
          <p className="mt-3.5 max-w-md text-base leading-7 text-muted-foreground">{panel.description}</p>
        </div>
        <div className="w-full flex-1">
          <div
            data-hover="brighten"
            className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-surface)] ring-1 ring-foreground/10"
          >
            <Image
              src={panel.image}
              alt={panel.index}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
