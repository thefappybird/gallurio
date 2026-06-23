"use client";

import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarIcon, TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INQUIRIES_VIEW_COOKIE_NAME,
  INQUIRIES_VIEW_STORAGE_KEY,
  persistViewPreference,
} from "@/lib/view-preferences";

export type InquiriesView = "table" | "calendar";

type Props = {
  view: InquiriesView;
};

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

  const options: Array<{ key: InquiriesView; label: string; icon: typeof TableIcon }> = [
    { key: "table", label: t("table"), icon: TableIcon },
    { key: "calendar", label: t("calendar"), icon: CalendarIcon },
  ];

  return (
    <div
      role="tablist"
      aria-label="Inquiries view toggle"
      className="flex w-full min-h-11 items-stretch border border-border bg-background sm:inline-flex sm:w-auto sm:h-9 sm:min-h-0"
    >
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={view === key}
          onClick={() => setView(key)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            view === key
              ? "bg-brand text-brand-foreground"
              : "bg-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
