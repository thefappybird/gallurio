"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { THEMES } from "@/lib/theme/themes";
import { routing } from "@/lib/i18n/routing";
import { useRouter, usePathname } from "@/lib/i18n/navigation";

export function CustomizePanel() {
  const { theme, setTheme } = useTheme();
  const tTheme = useTranslations("app.theme");
  const tCustomize = useTranslations("app.settings.customize");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(nextLocale: string) {
    if (nextLocale === currentLocale) return;
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Theme section */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{tCustomize("themeSection")}</h2>
          <p className="text-sm text-muted-foreground">{tCustomize("themeHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((opt) => {
            const Icon = opt.icon;
            const isActive = mounted && theme === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "flex items-center justify-center gap-2 border px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground"
                    : "border-border hover:border-muted-foreground focus-visible:border-muted-foreground"
                )}
              >
                <Icon
                  className="size-4 shrink-0"
                  suppressHydrationWarning
                />
                <span suppressHydrationWarning>
                  {mounted ? tTheme(opt.labelKey) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Language section */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">{tCustomize("languageSection")}</h2>
          <p className="text-sm text-muted-foreground">{tCustomize("languageHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {routing.locales.map((locale) => {
            const isActive = locale === currentLocale;

            return (
              <button
                key={locale}
                type="button"
                disabled={isActive}
                onClick={() => handleLocaleChange(locale)}
                className={cn(
                  "flex items-center justify-center gap-2 border px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground"
                    : "border-border hover:border-muted-foreground focus-visible:border-muted-foreground"
                )}
              >
                {tCustomize(`languages.${locale}`)}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
