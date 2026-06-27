"use client";

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
};

export function DashboardTabs({ tab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.dashboard.tabs");

  function setTab(next: DashboardTab) {
    if (next === tab) return;

    try {
      persistDashboardTab(next);
    } catch {
      // ignore — persistence is best-effort
    }

    // Preserve the date filter (from/to/dmode) across the switch.
    const params = new URLSearchParams(searchParams.toString());
    if (next === "bookings") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <SegmentedToggle
      value={tab}
      onChange={setTab}
      ariaLabel={t("aria")}
      options={[
        { key: "bookings", label: t("bookings"), icon: CalendarCheck2Icon },
        { key: "portfolio", label: t("portfolio"), icon: LayoutTemplateIcon },
      ]}
    />
  );
}
