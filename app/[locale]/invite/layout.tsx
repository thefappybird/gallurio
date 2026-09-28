import { NextIntlClientProvider } from "next-intl";

// Bare provider (no `messages`) — inherits the full request-locale catalog,
// restoring today's behaviour now that the root layout's provider is scoped
// down. See lib/i18n/clientMessages.ts.
export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
