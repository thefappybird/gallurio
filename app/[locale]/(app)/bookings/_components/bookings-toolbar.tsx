"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DownloadIcon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClearFiltersButton } from "@/components/app/clear-filters-button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/validators/booking";
import { CsvImportDialog } from "./csv-import-dialog";
import { TeamPicker } from "./team-picker";
import type { BookingsView } from "./view-toggle";
import type { BookingTeamOption } from "../_data/team-options";

const ALL = "__all__";

export function BookingsToolbar({
  defaultCurrency,
  onAddClick,
  view = "table",
  canCreate = true,
  teams = [],
  activeTeam = "all",
  isOwner = false,
}: {
  defaultCurrency: string;
  /** When provided, the "New Booking" button calls this directly instead of
   *  performing a URL push. Allows the parent to own the open state so the
   *  button always fires even when ?add=1 is already in the URL. */
  onAddClick?: () => void;
  /** Active view. In calendar view the status dropdown is hidden — the
   *  calendar's clickable color legend owns status filtering there. */
  view?: BookingsView;
  /** When false, the "New Booking" and "Import" buttons are hidden. Members
   *  are view-only — only owners can create or bulk-import bookings. Export
   *  remains visible because it is team-scoped server-side. */
  canCreate?: boolean;
  /** Available teams for the team filter picker. */
  teams?: BookingTeamOption[];
  /** Currently selected team id, or "all". */
  activeTeam?: string;
  /** Whether the current user is a workspace owner. */
  isOwner?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.toolbar");
  const tBookings = useTranslations("app.bookings");
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const next = searchParams.get("q") ?? "";
    Promise.resolve().then(() => setQ(next));
  }, [searchParams]);

  const status = searchParams.get("status") ?? ALL;
  const includeCancelled = searchParams.get("includeCancelled") === "1";
  const showPast = searchParams.get("showPast") === "1";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const exportHref = useMemo(() => {
    const p = new URLSearchParams();
    if (status && status !== ALL) p.set("status", status);
    if (q) p.set("q", q);
    if (includeCancelled) p.set("includeCancelled", "1");
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString();
    return `/api/bookings/export${qs ? `?${qs}` : ""}`;
  }, [status, q, includeCancelled, from, to]);

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname, searchParams]
  );

  // debounce the search input
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => pushParams({ q: q || null }), 250);
    return () => clearTimeout(id);
  }, [q, searchParams, pushParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="pl-8"
          />
        </div>

        {view !== "calendar" ? (
          <Select<string>
            value={status}
            onValueChange={(v) =>
              pushParams({ status: !v || v === ALL ? null : v })
            }
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue>
                {(value: string) =>
                  !value || value === ALL ? (
                    <span>{t("statusAll")}</span>
                  ) : (
                    <span className="capitalize">{value}</span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("statusAll")}</SelectItem>
              {BOOKING_STATUSES.map((s: BookingStatus) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {teams.length > 0 ? (
          <TeamPicker
            teams={teams}
            value={activeTeam}
            isOwner={isOwner}
            onChange={(v) => pushParams({ team: v === "all" ? null : v })}
          />
        ) : null}

        <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={includeCancelled}
            onCheckedChange={(v: boolean) =>
              pushParams({ includeCancelled: v ? "1" : null })
            }
          />
          <span className="select-none text-muted-foreground">
            {t("showCancelled")}
          </span>
        </label>

        <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={showPast}
            onCheckedChange={(v: boolean) =>
              pushParams({ showPast: v ? "1" : null })
            }
          />
          <span className="select-none text-muted-foreground">
            {t("showPast")}
          </span>
        </label>
      </div>

      <div className="flex w-full items-center sm:w-auto sm:flex-wrap sm:gap-2">
        <ClearFiltersButton
          paramKeys={["q", "status", "includeCancelled", "showPast", "from", "to"]}
        />
        {canCreate ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 flex-1 sm:flex-none sm:min-h-0"
            onClick={() => setImportOpen(true)}
          >
            <UploadIcon className="size-4" />
            {t("import")}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 flex-1 border-l-0 sm:flex-none sm:min-h-0 sm:border-l"
          title={tBookings("export.tooltip")}
          nativeButton={false}
          render={<a href={exportHref} download />}
        >
          <DownloadIcon className="size-4" />
          {t("export")}
        </Button>
        <CsvImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          defaultCurrency={defaultCurrency}
        />
        {canCreate ? (
          <Button
            variant="brand"
            size="sm"
            className="min-h-11 flex-1 border-l-0 sm:flex-none sm:min-h-0 sm:border-l-0"
            onClick={() => {
              if (onAddClick) {
                onAddClick();
              } else {
                const params = new URLSearchParams(searchParams.toString());
                params.set("add", "1");
                const qs = params.toString();
                startTransition(() => {
                  router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
                });
              }
            }}
          >
            <PlusIcon className="size-4" />
            {t("add")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
