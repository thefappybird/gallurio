import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/app/theme-provider";
import { DisableNumberInputSteppers } from "@/components/app/disable-number-input-steppers";
import { routing } from "@/lib/i18n/routing";
import { isRtl } from "@/lib/i18n/rtl";
import { portfolioFontVariables } from "@/lib/fonts/portfolio";
import { appThemeAttributes, DEFAULT_APP_THEME } from "@/lib/theme/appTheme";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Gallurio",
    template: "%s · Gallurio",
  },
  description:
    "The CRM for event businesses — bookings, clients, galleries, and inquiries in one workspace.",
  // Search crawlers receive a conventional raster icon with a stable URL.
  // The PNG is square and has an opaque light background, so the mark remains
  // recognizable on both light and dark search surfaces.
  icons: {
    icon: "/brand/gallurio-sq-white.png",
    shortcut: "/brand/gallurio-sq-white.png",
    apple: "/brand/gallurio-sq-white.png",
  },
  openGraph: {
    images: [{ alt: "Gallurio — Your event business, beautifully managed.", url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
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
      dir={isRtl(locale) ? "rtl" : "ltr"}
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
            <DisableNumberInputSteppers />
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
