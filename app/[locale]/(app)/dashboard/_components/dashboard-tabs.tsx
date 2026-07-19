"use client";

import { useEffect, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck2Icon, LayoutTemplateIcon } from "lucide-react";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import {
  persistDashboardTab,
  type DashboardTab,
} from "@/lib/dashboard-preferences";

type Props = {
  tab: DashboardTab;
  /** Notifies the parent when the tab-switch navigation is pending, so it can
   *  reflect the wait (e.g. dim the widget area below). */
  onPendingChange?: (pending: boolean) => void;
};

export function DashboardTabs({ tab, onPendingChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.dashboard.tabs");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  function setTab(next: DashboardTab) {
    if (next === tab) return;

    try {
      persistDashboardTab(next);
    } catch {
      // ignore — persistence is best-effort
    }

    // Preserve the date filter (df/d/m/y/from/to) across the switch.
    const params = new URLSearchParams(searchParams.toString());
    if (next === "bookings") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <SegmentedToggle
      value={tab}
      onChange={setTab}
      ariaLabel={t("aria")}
      disabled={isPending}
      options={[
        { key: "bookings", label: t("bookings"), icon: CalendarCheck2Icon },
        { key: "portfolio", label: t("portfolio"), icon: LayoutTemplateIcon },
      ]}
    />
  );
}
