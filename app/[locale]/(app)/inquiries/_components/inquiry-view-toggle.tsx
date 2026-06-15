"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarIcon, TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type InquiriesView = "table" | "calendar";

const STORAGE_KEY = "gallurio.inquiries.view";

type Props = {
  view: InquiriesView;
};

export function InquiryViewToggle({ view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.view");

  // On first paint, if the URL didn't specify a view but localStorage has a
  // saved preference, redirect to that view so the user lands where they left
  // off. The server-side default (table) renders first, then this snaps over.
  useEffect(() => {
    const urlHasView = searchParams.get("view") !== null;
    if (urlHasView) return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "calendar" && view !== "calendar") {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", "calendar");
        router.replace(`${pathname}?${params.toString()}`);
      }
    } catch {
      // localStorage may be unavailable (privacy mode); silently fall through.
    }
    // Only want to run on mount — not when searchParams change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setView(next: InquiriesView) {
    if (next === view) return;
    // Save the preference so the next visit (without ?view in the URL) lands
    // here automatically.
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
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
