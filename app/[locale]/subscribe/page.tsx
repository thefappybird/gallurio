import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { LogOutIcon } from "lucide-react";
import { requireOrg } from "@/lib/auth/requireOrg";
import { User } from "@/lib/db/models";
import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { sanitizeLocalReturnTo } from "@/lib/http/localReturnTo";
import { SignOutLink } from "@/components/app/sign-out-link";
import { SubscribePanel } from "./_panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subscribe");
  return { title: t("pageTitle") };
}

export default async function SubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subscribe");
  const { returnTo: rawReturnTo } = await searchParams;
  // Untrusted query param — sanitize before it ever reaches the client
  // component, which uses it for a client-side redirect after checkout.
  const returnTo = sanitizeLocalReturnTo(rawReturnTo);

  const { role, userId } = await requireOrg({
    allowDuringOnboarding: true,
    allowWhenGated: true,
  });

  if (role === "owner") {
    const [proPricing, user] = await Promise.all([
      getDisplayPricing(),
      User.findOne(
        { workosUserId: userId },
        { "betaParticipation.recordedAt": 1 },
      ).lean(),
    ]);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 px-4 py-12">
        <div className="w-full max-w-md border border-border bg-background p-8">
          <h1 className="mb-2 text-xl font-semibold tracking-tight">
            {t("owner.title")}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("owner.description")}
          </p>
          <SubscribePanel
            proPricing={proPricing}
            returnTo={returnTo}
            betaAvailable={
              process.env.BETA_TESTER_ENABLED === "true" &&
              !user?.betaParticipation?.recordedAt
            }
          />
        </div>
        <SignOutLink>
          <LogOutIcon className="size-3.5 shrink-0" aria-hidden />
          {t("logout")}
        </SignOutLink>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm border border-border bg-background p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold tracking-tight">
          {t("staff.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("staff.description")}</p>
      </div>
      <SignOutLink>
        <LogOutIcon className="size-3.5 shrink-0" aria-hidden />
        {t("logout")}
      </SignOutLink>
    </div>
  );
}
