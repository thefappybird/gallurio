"use client";

import { useLocale, useTranslations } from "next-intl";
import { LanguagesIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { routing, type Locale } from "@/lib/i18n/routing";

// Footer control that switches the app locale. Reuses the native language names
// already in the catalog (app.settings.customize.languages) so labels stay in
// sync with the locale list. Navigation keeps the current path and only swaps
// the locale segment (next-intl rewrites /clients -> /ar/clients etc.).
export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const active = useLocale();
  const t = useTranslations("app.settings.customize");
  const names = useTranslations("app.settings.customize.languages");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            tooltip={t("languageSection")}
            className="group-data-[collapsible=icon]:mx-auto"
          >
            <LanguagesIcon className="size-5! shrink-0" />
            <span>{names(active)}</span>
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent side="inline-end" align="start">
        {routing.locales.map((locale: Locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => router.replace(pathname, { locale })}
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
