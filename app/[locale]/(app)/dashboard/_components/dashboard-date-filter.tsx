"use client";

import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import type { DateRangeMode } from "@/lib/dashboard/date-range";

type FilterMode = "all" | DateRangeMode;

function isMode(v: string | null): v is DateRangeMode {
  return v === "until" || v === "between" || v === "since";
}

export function DashboardDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useTranslations("app.dashboard.dateFilter");

  const rawMode = sp.get("dmode");
  const mode: FilterMode = isMode(rawMode) ? rawMode : "all";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  function push(next: Partial<Record<"dmode" | "from" | "to", string | null>>) {
    const params = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setMode(next: FilterMode) {
    if (next === mode) return;
    if (next === "all") {
      push({ dmode: null, from: null, to: null });
      return;
    }
    // Switching modes keeps any already-entered dates that the new mode uses.
    push({ dmode: next });
  }

  const showFrom = mode === "between" || mode === "since";
  const showTo = mode === "between" || mode === "until";

  const inputClass =
    "h-9 rounded-[var(--radius)] border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <SegmentedToggle
        value={mode}
        onChange={setMode}
        ariaLabel={t("label")}
        className="sm:w-auto"
        options={[
          { key: "all", label: t("allTime") },
          { key: "until", label: t("until") },
          { key: "between", label: t("between") },
          { key: "since", label: t("since") },
        ]}
      />

      {(showFrom || showTo) && (
        <div className="flex items-center gap-2">
          {showFrom && (
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="sr-only sm:not-sr-only">{t("from")}</span>
              <input
                type="date"
                aria-label={t("from")}
                value={from}
                max={showTo && to ? to : undefined}
                onChange={(e) => push({ from: e.target.value || null })}
                className={inputClass}
              />
            </label>
          )}
          {showTo && (
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="sr-only sm:not-sr-only">{t("to")}</span>
              <input
                type="date"
                aria-label={t("to")}
                value={to}
                min={showFrom && from ? from : undefined}
                onChange={(e) => push({ to: e.target.value || null })}
                className={inputClass}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
