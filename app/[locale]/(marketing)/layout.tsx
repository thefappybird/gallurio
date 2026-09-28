import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages, MARKETING_CLIENT_MESSAGE_KEYS } from "@/lib/i18n/clientMessages";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/marketing-footer";

// Shared shell for the public marketing surface (landing + compliance pages).
// Header/footer are client components so each can detect the landing route
// and switch to the dark-hero-matching tone — see marketing-header.tsx.
//
// The root layout's provider is scoped down to ROOT_CLIENT_MESSAGE_KEYS (near
// empty), so this nested provider re-scopes to what marketing's client tree
// actually reads — see lib/i18n/clientMessages.ts.
export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={pickMessages(messages, MARKETING_CLIENT_MESSAGE_KEYS)}>
      <div className="flex flex-1 flex-col">
        <MarketingHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  );
}
