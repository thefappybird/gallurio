import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/app/theme-provider";
import { routing } from "@/lib/i18n/routing";
import { portfolioFontVariables } from "@/lib/fonts/portfolio";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gallurio",
    template: "%s · Gallurio",
  },
  description:
    "The CRM for event businesses — bookings, clients, galleries, and inquiries in one workspace.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Opts every route into static rendering for translated content — without
  // this, any getTranslations() call flips the page to dynamic.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${portfolioFontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <NextIntlClientProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
