"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { SunIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { THEMES, resolveScheme } from "@/lib/theme/themes";

export function ThemeToggle({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "standalone";
} = {}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const t = useTranslations("app.theme");

  // next-themes resolves client-side only — render a neutral icon during SSR
  // and the first paint so hydration doesn't mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  // Trigger icon mirrors the active theme's icon. Before mount we always show
  // SunIcon so server and client render identically.
  const activeEntry = THEMES.find((opt) => opt.id === theme);
  const triggerIcon = !mounted
    ? SunIcon
    : (activeEntry?.icon ??
        THEMES.find((opt) => opt.id === resolveScheme(resolvedTheme))?.icon ??
        SunIcon);
  const TriggerIcon = triggerIcon;
  const menuPosition = variant === "standalone" ? { side: "bottom" as const, align: "end" as const } : { side: "inline-end" as const, align: "start" as const };

  const trigger =
    variant === "standalone" ? (
      <Button variant="ghost" size="icon" aria-label={t("label")}>
        <TriggerIcon suppressHydrationWarning />
      </Button>
    ) : (
      <SidebarMenuButton
        tooltip={t("label")}
        className="group-data-[collapsible=icon]:mx-auto"
      >
        <TriggerIcon suppressHydrationWarning />
        <span>{t("label")}</span>
      </SidebarMenuButton>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent {...menuPosition}>
        {THEMES.map((opt) => {
          const Icon = opt.icon;
          return (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              data-active={theme === opt.id}
              className="data-[active=true]:bg-brand/12 data-[active=true]:font-medium data-[active=true]:text-brand"
            >
              <Icon className="size-4" />
              {t(opt.labelKey)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
