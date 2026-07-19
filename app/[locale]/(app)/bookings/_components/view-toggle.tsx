"use client";

import { useEffect, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarIcon, TableIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import {
  BOOKINGS_VIEW_COOKIE_NAME,
  BOOKINGS_VIEW_STORAGE_KEY,
  persistViewPreference,
} from "@/lib/view-preferences";

export type BookingsView = "table" | "calendar";

type Props = {
  view: BookingsView;
  onPendingChange?: (pending: boolean) => void;
};

function ResponsiveTableLabel({
  mobile,
  desktop,
}: {
  mobile: string;
  desktop: string;
}): ReactNode {
  return (
    <>
      <span className="lg:hidden">{mobile}</span>
      <span className="hidden lg:inline">{desktop}</span>
    </>
  );
}

export function ViewToggle({ view, onPendingChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.view");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  function setView(next: BookingsView) {
    if (next === view) return;

    try {
      persistViewPreference(BOOKINGS_VIEW_STORAGE_KEY, BOOKINGS_VIEW_COOKIE_NAME, next);
    } catch {
      // ignore
    }

    const params = new URLSearchParams(searchParams.toString());
    if (next === "table") {
      params.delete("view");
    } else {
      params.set("view", next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <SegmentedToggle
      value={view}
      onChange={setView}
      ariaLabel={t("table")}
      disabled={isPending}
      options={[
        {
          key: "table",
          label: <ResponsiveTableLabel mobile={t("card")} desktop={t("table")} />,
          ariaLabel: t("table"),
          icon: TableIcon,
        },
        { key: "calendar", label: t("calendar"), icon: CalendarIcon },
      ]}
    />
  );
}
