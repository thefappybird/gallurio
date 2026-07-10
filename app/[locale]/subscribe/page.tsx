import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getProPricing } from "@/lib/lemonsqueezy/pricing";
import { sanitizeLocalReturnTo } from "@/lib/http/localReturnTo";
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

  const { role } = await requireOrg({
    allowDuringOnboarding: true,
    allowWhenGated: true,
  });

  if (role === "owner") {
    const proPricing = await getProPricing();
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
        <div className="w-full max-w-md border border-border bg-background p-8">
          <h1 className="mb-2 text-xl font-semibold tracking-tight">
            {t("owner.title")}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("owner.description")}
          </p>
          <SubscribePanel proPricing={proPricing} returnTo={returnTo} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm border border-border bg-background p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold tracking-tight">
          {t("staff.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("staff.description")}</p>
      </div>
    </div>
  );
}
