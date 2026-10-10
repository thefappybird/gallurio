import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { applyVocabulary } from "@/lib/vocabulary/apply";

// Full request-locale catalog (see lib/i18n/clientMessages.ts) with the
// standard vocabulary preset applied so `app.*` %tokens% never leak.
export default async function PortfolioMakerDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = applyVocabulary((await getMessages()) as Record<string, unknown>, locale, "standard");
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
