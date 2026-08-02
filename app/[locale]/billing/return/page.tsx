import { setRequestLocale } from "next-intl/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { sanitizeLocalReturnTo } from "@/lib/http/localReturnTo";
import { BillingVerification } from "./verification";

// Lemon Squeezy's hosted completion redirect. Unlike Settings, this route is
// intentionally available to a gated owner. Its client verification step
// writes and re-reads the workspace before navigating to the requested local
// destination. The webhook remains the authoritative, durable path.
export default async function BillingReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ locale }, { returnTo: rawReturnTo }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  await requireOrg({ allowDuringOnboarding: true, allowWhenGated: true });
  return <BillingVerification returnTo={sanitizeLocalReturnTo(rawReturnTo) ?? "/settings/billing"} />;
}
