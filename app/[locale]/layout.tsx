import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/app/theme-provider";
import { routing } from "@/lib/i18n/routing";
import { portfolioFontVariables } from "@/lib/fonts/portfolio";
import { appThemeAttributes, DEFAULT_APP_THEME } from "@/lib/theme/appTheme";
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
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${portfolioFontVariables} h-full antialiased`}
      // Default corner-style preset (app-shell theming seam). A future
      // user-theming UI resolves a persisted AppThemeConfig here instead of the
      // default; components already read the CSS-var seam. See lib/theme/appTheme.ts.
      {...appThemeAttributes(DEFAULT_APP_THEME)}
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
