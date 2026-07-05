"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LanguagesIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { routing, type Locale } from "@/lib/i18n/routing";

// Footer control that switches the app locale. Reuses the native language names
// already in the catalog (app.settings.customize.languages) so labels stay in
// sync with the locale list. Navigation keeps the current path AND query string
// and only swaps the locale segment (next-intl rewrites /clients?x=1 ->
// /ar/clients?x=1 etc.), so switching language never resets filters/date/tab
// state encoded in the URL.
export function LocaleSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "standalone";
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = useLocale();
  const t = useTranslations("app.settings.customize");
  const names = useTranslations("app.settings.customize.languages");
  const qs = searchParams.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;

  const trigger =
    variant === "standalone" ? (
      <Button variant="ghost" size="icon" aria-label={names(active)}>
        <LanguagesIcon className="size-5! shrink-0" />
      </Button>
    ) : (
      <SidebarMenuButton
        tooltip={t("languageSection")}
        className="group-data-[collapsible=icon]:mx-auto"
      >
        <LanguagesIcon className="size-5! shrink-0" />
        <span>{names(active)}</span>
      </SidebarMenuButton>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent side="inline-end" align="start">
        {routing.locales.map((locale: Locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => router.replace(href, { locale })}
            data-active={locale === active}
            className="data-[active=true]:bg-brand/12 data-[active=true]:font-medium data-[active=true]:text-brand"
          >
            {names(locale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
