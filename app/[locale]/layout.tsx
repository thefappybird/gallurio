import type { Metadata } from "next";
import { notFound } from "next/navigation";
import localFont from "next/font/local";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/app/theme-provider";
import { routing } from "@/lib/i18n/routing";
import { portfolioFontVariables } from "@/lib/fonts/portfolio";
import "../globals.css";

// Self-hosted Merriweather (app-shell font). Bundled locally so builds never
// depend on a Google Fonts fetch and stay reproducible offline.
const merriweather = localFont({
  variable: "--font-merriweather",
  display: "swap",
  src: [
    { path: "../fonts/merriweather-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/merriweather-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/merriweather-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/merriweather-latin-900-normal.woff2", weight: "900", style: "normal" },
    { path: "../fonts/merriweather-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/merriweather-latin-700-italic.woff2", weight: "700", style: "italic" },
  ],
});

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
      className={`${merriweather.variable} ${portfolioFontVariables} h-full antialiased`}
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
