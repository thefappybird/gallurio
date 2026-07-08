"use client";

import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarIcon, TableIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import {
  INQUIRIES_VIEW_COOKIE_NAME,
  INQUIRIES_VIEW_STORAGE_KEY,
  persistViewPreference,
} from "@/lib/view-preferences";

export type InquiriesView = "table" | "calendar";

type Props = {
  view: InquiriesView;
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

export function InquiryViewToggle({ view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.view");

  function setView(next: InquiriesView) {
    if (next === view) return;

    try {
      persistViewPreference(INQUIRIES_VIEW_STORAGE_KEY, INQUIRIES_VIEW_COOKIE_NAME, next);
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
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <SegmentedToggle
      value={view}
      onChange={setView}
      ariaLabel="Inquiries view toggle"
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
