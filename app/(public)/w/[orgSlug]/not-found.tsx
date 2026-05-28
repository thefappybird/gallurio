/**
 * Shown when:
 * - The workspace slug does not exist, or
 * - The workspace exists but has not been published (`publishedAt === null`).
 *
 * No app chrome — this page is outside the authenticated shell.
 */
import { getTranslations } from "next-intl/server";

// Locale is hardcoded to "en" because this page has no workspace context — there
// is no workspace doc to call localeForCountry() on when a slug is not found.
export default async function PortfolioNotFound() {
  const t = await getTranslations({ locale: "en", namespace: "publicPage.chrome" });

  return (
    <main
      style={{ fontFamily: "'Merriweather', serif" }}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
    >
      <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
        {t("notFoundEyebrow")}
      </p>
      <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
      <p className="max-w-sm text-base text-muted-foreground">
        {t("notFoundBody")}
      </p>
    </main>
  );
}
