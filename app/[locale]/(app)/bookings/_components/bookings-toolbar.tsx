"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { BookingsExportDialog } from "./bookings-export-dialog";
import { InvoiceThemeDialog } from "./invoice-theme-dialog";
import { TeamPicker } from "./team-picker";
import type { BookingsView } from "./view-toggle";
import type { BookingTeamOption } from "../_data/team-options";
import { parseBookingsToggleFilters } from "../_data/booking-filters";
import type { InvoiceThemePresetId, InvoiceThemePreviewBusiness } from "@/lib/invoices/theme";

const ALL = "__all__";

export function BookingsToolbar({
  defaultCurrency,
  workspaceTimezone,
  onAddClick,
  view = "table",
  canCreate = true,
  teams = [],
  selectedTeams = [],
  isOwner = false,
  initialInvoiceTheme,
  invoiceThemeBusiness,
  onPendingChange,
}: {
  defaultCurrency: string;
  /** Passed to the importer so its preview applies the same same-day rule the
   *  route enforces at commit. */
  workspaceTimezone?: string;
  /** Notifies the parent when a filter-change navigation is pending, so it can
   *  reflect the wait (e.g. surface the bookings table's loading skeleton). */
  onPendingChange?: (pending: boolean) => void;
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
  /** Currently selected team ids. Empty = all teams. */
  selectedTeams?: string[];
  /** Whether the current user is a workspace owner. */
  isOwner?: boolean;
  /** Workspace's current invoice PDF theme — seeds the Invoice theme dialog. */
  initialInvoiceTheme?: { preset: InvoiceThemePresetId | "custom"; main: string; accent: string };
  invoiceThemeBusiness?: InvoiceThemePreviewBusiness;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.toolbar");
  const tBookings = useTranslations("app.bookings");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [invoiceThemeOpen, setInvoiceThemeOpen] = useState(false);

  // Keep a ref to the latest searchParams so pushParams never captures a stale
  // closure AND never needs searchParams in its own dependency array (which
  // would give it a new identity every render and break the debounce effect).
  const searchParamsRef = useRef(searchParams);
  // eslint-disable-next-line react-hooks/refs -- intentional: mutable ref updated during render to always hold the latest value; only read in effects/callbacks, never during render itself
  searchParamsRef.current = searchParams;

  // Sync the search-box value with external URL changes (browser back/forward,
  // link navigation). Guard with a value equality check so React can bail out
  // when the value hasn't actually changed, preventing an extra render cycle.
  useEffect(() => {
    const next = searchParams.get("q") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs controlled input with URL-driven searchParams (external → React sync for back/forward and link navigation)
    setQ((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const status = searchParams.get("status") ?? ALL;
  const { includeCancelled, includePast: showPast } = parseBookingsToggleFilters({
    includeCancelled: searchParams.get("includeCancelled") ?? undefined,
    showPast: searchParams.get("showPast") ?? undefined,
  });
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // The list's own filters. The export dialog owns team, range and format and
  // appends them to this, so a download still matches what's on screen.
  const exportParams = useMemo(() => {
    const p = new URLSearchParams();
    if (status && status !== ALL) p.set("status", status);
    if (q) p.set("q", q);
    // Opt-out params: only sent when the filter is OFF, so the exported rows
    // match the table for both toggles.
    if (!includeCancelled) p.set("includeCancelled", "0");
    if (!showPast) p.set("showPast", "0");
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [status, q, includeCancelled, showPast, from, to]);

  // pushParams reads searchParams via a ref so its identity only changes when
  // router or pathname changes — never on every searchParams object replacement.
  // This breaks the cycle: debounce-effect deps no longer change each render.
  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname]
  );

  // Debounce the search-box input. The only deps that should change here are
  // `q` (typed by the user) and `pushParams` (stable unless route changes).
  // Removing `searchParams` from deps prevents the effect from re-firing every
  // time the URL object is replaced — which is what caused the render loop.
  useEffect(() => {
    const current = searchParamsRef.current.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => pushParams({ q: q || null }), 250);
    return () => clearTimeout(id);
  }, [q, pushParams]);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-2">
      <div
        data-testid="booking-filter-controls"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-3"
      >
        <div className="relative w-full min-[420px]:w-64 sm:w-80">
          <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="ps-8"
          />
        </div>

        {/* Status filter — a plain dropdown in BOTH views (the calendar status
            legend was retired; status now shows per-candle as a pill). */}
        <Select<string>
          value={status}
          onValueChange={(v) => pushParams({ status: !v || v === ALL ? null : v })}
        >
          <SelectTrigger className="h-8 w-full shrink-0 rounded-lg border-border px-2.5 font-normal hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground min-[360px]:w-40 sm:w-48">
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
          <SelectContent className="rounded-lg border-border bg-background p-1 shadow-none sm:min-w-48">
            <SelectItem
              value={ALL}
              className="min-h-8 rounded-md px-2.5 py-1 pe-7 font-normal data-highlighted:bg-muted data-highlighted:text-foreground"
            >
              {t("statusAll")}
            </SelectItem>
            {BOOKING_STATUSES.map((s: BookingStatus) => (
              <SelectItem
                key={s}
                value={s}
                className="min-h-8 rounded-md px-2.5 py-1 pe-7 font-normal capitalize data-highlighted:bg-muted data-highlighted:text-foreground"
              >
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Team filter — dropdown in TABLE view only; calendar uses the
            clickable team legend inside the calendar. Hidden for single-team
            members/leads (nothing to filter); always shown for owners. */}
        {view !== "calendar" && (isOwner || teams.length > 1) ? (
          <TeamPicker
            teams={teams}
            selected={selectedTeams}
            isOwner={isOwner}
            onChange={(next) => pushParams({ team: next.length ? next.join(",") : null })}
          />
        ) : null}

        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={includeCancelled}
              onCheckedChange={(v: boolean) =>
                pushParams({ includeCancelled: v ? null : "0" })
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
                pushParams({ showPast: v ? null : "0" })
              }
            />
            <span className="select-none text-muted-foreground">
              {t("showPast")}
            </span>
          </label>
        </div>
      </div>

      <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto">
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
        {/* One button, because format is no longer the only choice: the dialog
            also picks a team and a time range. */}
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 flex-1 sm:flex-none sm:min-h-0"
          title={tBookings("export.tooltip")}
          onClick={() => setExportOpen(true)}
        >
          <DownloadIcon className="size-4" />
          {t("export")}
        </Button>
        {isOwner ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 flex-1 sm:flex-none sm:min-h-0"
            onClick={() => setInvoiceThemeOpen(true)}
          >
            {t("invoiceTheme")}
          </Button>
        ) : null}
        <BookingsExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          baseParams={exportParams}
          teams={teams}
        />
        <CsvImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          defaultCurrency={defaultCurrency}
          workspaceTimezone={workspaceTimezone}
          teams={teams}
        />
        {initialInvoiceTheme ? (
          <InvoiceThemeDialog
            open={invoiceThemeOpen}
            onClose={() => setInvoiceThemeOpen(false)}
            initialTheme={initialInvoiceTheme}
            business={invoiceThemeBusiness}
          />
        ) : null}
        {canCreate ? (
          <Button
            variant="brand"
            size="sm"
            className="min-h-11 flex-1 border-s-0 sm:flex-none sm:min-h-0 sm:border-s-0"
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
