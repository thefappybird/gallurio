import { requireOrg } from "@/lib/auth/requireOrg";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";
import { getBookingTeamOptions } from "./_data/team-options";
import { connectDB } from "@/lib/db/mongoose";
import type { BookingDoc } from "@/lib/db/models";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CalendarSkeleton } from "@/components/app/calendar-skeleton";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { BOOKINGS_SKELETON } from "@/lib/tables/skeleton-metrics";
import { BookingsHeaderSkeleton } from "./_components/bookings-page-skeleton";
import { listBookings } from "./_data/bookings-queries";
import { loadBookingsCalendarEvents, parseCalendarDate } from "./_data/calendar-events";
import { bookingRowAmount } from "./_data/booking-rows";
import { getWorkspaceRateMap, NO_CONVERSION } from "@/lib/pricing/workspaceRates";
import { parseBookingsToggleFilters } from "./_data/booking-filters";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import { type BookingsView } from "./_components/view-toggle";
import { BookingsPendingShell } from "./_components/bookings-pending-shell";
import { CalendarBookingManager } from "./_components/calendar-booking-manager";
import { TableBookingManager } from "./_components/table-booking-manager";
import {
  type BookingRow,
} from "./_components/bookings-table";
import { BookingsPageClient } from "./_components/bookings-page-client";
import {
  TABLE_FIT_COOKIE,
  parseFitCookie,
  resolveLimit,
  resolvePageSize,
} from "@/lib/tables/page-fit";
import { parseSort } from "@/lib/tables/sort";
import { BookingUrlModals } from "./_components/booking-url-modals";
import type { CalendarEvent } from "./_components/booking-calendar";
import type { BookingStatus } from "@/lib/validators/booking";
import type { SupportedCurrency } from "@/lib/validators/workspace";
import { BOOKINGS_VIEW_COOKIE_NAME } from "@/lib/view-preferences";
import { resolveStoredCollectionView } from "@/lib/view-preferences.server";
import { INVOICE_THEME_PRESETS } from "@/lib/invoices/theme";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.sidebar");
  return { title: t("bookings") };
}

type SearchParams = {
  view?: string;
  team?: string;
  date?: string;
  time?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  includeCancelled?: string;
  showPast?: string;
  detail?: string;
  add?: string;
  edit?: string;
  page?: string;
  limit?: string;
  sort?: string;
  dir?: string;
};

// BookingsTable columns: title, client, date, booked, status, total, actions = 7
const BOOKINGS_TABLE_COLUMNS = 7;

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const view = (await resolveStoredCollectionView(
    sp.view,
    BOOKINGS_VIEW_COOKIE_NAME
  )) as BookingsView;

  // Resolved before the Suspense boundary so the fallback skeleton renders the
  // exact row count the table will (no layout shift on stream-in).
  const fit = parseFitCookie((await cookies()).get(TABLE_FIT_COOKIE.bookings)?.value);
  const limit = resolveLimit(sp.limit, fit);

  // Everything data-dependent streams behind a per-view boundary: switching
  // table <-> calendar shows the matching skeleton immediately.
  return (
    <Suspense
      key={view}
      fallback={
        <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
          <BookingsHeaderSkeleton />
          {view === "calendar" ? (
            <CalendarSkeleton />
          ) : (
            <TableSkeleton columns={BOOKINGS_TABLE_COLUMNS} rows={limit} cardRows={4} {...BOOKINGS_SKELETON} />
          )}
        </div>
      }
    >
      <BookingsContent locale={locale} sp={sp} view={view} limit={limit} fit={fit} />
    </Suspense>
  );
}

async function BookingsContent({
  locale,
  sp,
  view,
  limit,
  fit,
}: {
  locale: string;
  sp: SearchParams;
  view: BookingsView;
  limit: number;
  fit: number | undefined;
}) {
  const t = await getTranslations("app.bookings");
  const tCal = await getTranslations("app.calendar");

  const { workspace, role, userId } = await requireOrg();
  await connectDB();

  // Team visibility: owners see the whole workspace; non-owners (staff) see only
  // bookings owned by teams they belong to. An empty membership list yields an
  // empty `teamIds` array → the query matches nothing (fail-closed).
  const allowedTeamIds = await resolveBookingTeamScope({ role, userId, workspace });

  // Phase 5 — team scoping. Owners see every team; non-owners see only their own
  // (both include deactivated teams, shown as view-only choices).
  const teamOptions = await getBookingTeamOptions({ role, userId, workspace });
  // Writable = active teams the caller may create for (owner: any active team;
  // others: active teams they lead). Members with no lead team cannot create.
  const writableTeams = teamOptions.filter((o) => o.isActive && (role === "owner" || o.isLead));
  const canCreate = writableTeams.length > 0;
  // `?team` is a comma-separated list of team ids to show; empty/absent/"all"
  // means all visible teams. Each id must be in the caller's visible set.
  const requestedTeamIds =
    sp.team && sp.team !== "all"
      ? sp.team.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const selectedTeamIds = requestedTeamIds.filter((id) => teamOptions.some((o) => o.id === id));
  // Calendar candles are always colored by team (the team legend is the calendar
  // filter + color key); status is shown per-candle via a status pill. The map
  // carries ACTIVE teams' colors; inactive teams fall through to the calendar's
  // neutral "archival" color.
  const colorMode: "team" | "status" = "team";
  const teamColorMap: Record<string, string> = Object.fromEntries(
    teamOptions.filter((o) => o.isActive).map((o) => [o.id, o.color]),
  );
  // New bookings default to the selected team when exactly one is selected (and
  // writable), else the caller's first writable team (owner → Main, sorts first).
  const writableIds = new Set(writableTeams.map((w) => w.id));
  const defaultTeamId: string | null =
    selectedTeamIds.length === 1 && writableIds.has(selectedTeamIds[0])
      ? selectedTeamIds[0]
      : (writableTeams[0]?.id ?? null);

  // When exactly one team is in the effective scope — a single-team member/lead,
  // or anyone filtered down to one team — title the page "{team}'s Bookings".
  // Otherwise the plain "Bookings". (Single-team non-owners also lose the filter,
  // gated in the toolbar/calendar via isOwner + team count.)
  const effectiveTeamIds = selectedTeamIds.length > 0 ? selectedTeamIds : teamOptions.map((o) => o.id);
  const scopedTeamName =
    effectiveTeamIds.length === 1
      ? (teamOptions.find((o) => o.id === effectiveTeamIds[0])?.name ?? null)
      : null;
  const pageTitle = scopedTeamName ? t("titleForTeam", { team: scopedTeamName }) : t("title");

  // Parse pagination params (table view only).
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const tablePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const tableLimit = limit;
  const pageSizeOptions = resolvePageSize(fit).options;
  const sort = parseSort("bookings", sp);

  // Cancelled + past filters are opt-OUT (absent -> ON); see parseBookingsToggleFilters.
  const toggleFlags = parseBookingsToggleFilters(sp);
  const showPastParam = toggleFlags.includePast;
  const filters = {
    status: sp.status ?? null,
    q: sp.q ?? null,
    from: sp.from ? new Date(sp.from) : null,
    to: sp.to ? new Date(sp.to) : null,
    includeCancelled: toggleFlags.includeCancelled,
    includePast: showPastParam,
    workspaceTimezone: (workspace as { timezone?: string | null }).timezone ?? FALLBACK_TZ,
    // A team selection narrows within the caller's visibility scope; an empty
    // selection falls back to the full visibility scope (owner: undefined = all).
    teamIds: selectedTeamIds.length > 0 ? selectedTeamIds : allowedTeamIds,
  };
  const hasFilters = Boolean(
    sp.q ||
    (sp.status && sp.status !== "all") ||
    sp.from ||
    sp.to ||
    !toggleFlags.includeCancelled ||
    !toggleFlags.includePast ||
    selectedTeamIds.length > 0,
  );

  // These reads are independent — run them together to save a round-trip.
  //  - Calendar view: candles for the month window only (one windowed query).
  //    Table view: fetch only one page of bookings.
  const defaultDate = parseCalendarDate(sp.date, filters.workspaceTimezone);
  const eventsWindow = calendarWindow(defaultDate, filters.workspaceTimezone);
  const [{ rows: bookings, total: bookingsTotal }, events] = await Promise.all([
    view === "calendar"
      ? Promise.resolve({ rows: [] as BookingDoc[], total: 0 })
      : listBookings(workspace._id, filters, {
          page: tablePage,
          limit: tableLimit,
          sort: { field: sort.field, dir: sort.dir, text: sort.text },
        }),
    view === "calendar"
      ? loadBookingsCalendarEvents({
          workspaceId: workspace._id,
          tz: filters.workspaceTimezone,
          date: defaultDate,
          filters,
        })
      : Promise.resolve([] as CalendarEvent[]),
  ]);

  // If the requested table page lies past the end of a non-empty result set
  // (stale bookmark, post-filter narrowing), redirect to the last valid page
  // rather than render an empty table whose footer claims rows exist.
  // NOTE: check applies regardless of tablePage value — including page 1 —
  // so a freshly filtered result set whose first page would be empty also
  // redirects to the correct last page.
  if (view === "table" && bookingsTotal > 0) {
    const totalPages = Math.ceil(bookingsTotal / tableLimit);
    if (tablePage > totalPages) {
      const next = new URLSearchParams(
        Object.entries(sp).filter(
          ([k, v]) => k !== "page" && v !== undefined
        ) as [string, string][]
      );
      next.set("page", String(totalPages));
      redirect(`/${locale}/bookings?${next.toString()}`);
    }
  }

  // List rows always read in the workspace currency — see bookingRowAmount.
  // Only table rows use the rate map; skip the lookup in calendar view.
  const fx =
    view === "calendar"
      ? NO_CONVERSION
      : await getWorkspaceRateMap(workspace._id, workspace.currency);

  const rows: BookingRow[] = bookings.map((b) => {
    const bSessions = b.sessions as { startAt: Date; endAt: Date }[];
    // lastSessionEnd = max(endAt) across all sessions — used to compute isPast.
    const lastSessionEnd = bSessions.reduce<string>((max, s) => {
      const iso = new Date(s.endAt).toISOString();
      return iso > max ? iso : max;
    }, new Date(0).toISOString());
    return {
      id: b._id.toString(),
      title: b.title,
      clientName: b.clientName,
      sessions: bSessions.map((s) => ({
        startAt: new Date(s.startAt).toISOString(),
        endAt: new Date(s.endAt).toISOString(),
      })),
      lastSessionEnd,
      bookedAt: b.bookedAt ? new Date(b.bookedAt).toISOString() : null,
      status: b.status as BookingStatus,
      ...bookingRowAmount(b.amount, fx.rates, fx.target),
    };
  });

  // `.lean()` in requireOrg() skips schema defaults, so workspaces created before
  // `invoiceTheme` existed have no key at all (not the schema default) — fall
  // back to the classic preset so the toolbar always has a value to seed.
  const invoiceTheme = workspace.invoiceTheme ?? {
    preset: "classic" as const,
    ...INVOICE_THEME_PRESETS.classic,
  };
  const invoiceThemeBusiness = {
    name: workspace.name,
    logoUrl: workspace.logoUrl ?? "",
    address: workspace.contact?.address ?? "",
    email: workspace.contact?.email ?? "",
    currency: workspace.currency,
  };

  // Gates the pre-download completeness warning in the booking detail modal —
  // both fields must be non-empty for invoices/receipts to render complete.
  const businessComplete = Boolean(
    workspace.contact?.address?.trim() && workspace.contact?.email?.trim()
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BookingsPendingShell
        title={<h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>}
        view={view}
      >
        <>
          {view !== "calendar" ? (
            // Table view: TableBookingManager owns the "New Booking" open state so
            // the button always fires even when ?add=1 is already in the URL.
            <TableBookingManager
              defaultCurrency={workspace.currency as SupportedCurrency}
              locale={locale}
              workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
              canCreate={canCreate}
              defaultTeamId={defaultTeamId}
              teams={teamOptions}
              selectedTeams={selectedTeamIds}
              writableTeams={writableTeams}
              isOwner={role === "owner"}
              initialInvoiceTheme={invoiceTheme}
              invoiceThemeBusiness={invoiceThemeBusiness}
            />
          ) : null}

          {view === "calendar" ? (
            <CalendarBookingManager
              events={events}
              defaultDate={defaultDate}
              defaultCurrency={workspace.currency as SupportedCurrency}
              locale={locale}
              workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
              canCreate={canCreate}
              defaultTeamId={defaultTeamId}
              teams={teamOptions}
              selectedTeams={selectedTeamIds}
              writableTeams={writableTeams}
              isOwner={role === "owner"}
              initialInvoiceTheme={invoiceTheme}
              invoiceThemeBusiness={invoiceThemeBusiness}
              colorMode={colorMode}
              teamColorMap={teamColorMap}
              window={{ start: eventsWindow.start.toISOString(), end: eventsWindow.end.toISOString() }}
              messages={{
                today: tCal("today"),
                previous: tCal("previous"),
                next: tCal("next"),
                day: tCal("views.day"),
                week: tCal("views.week"),
                month: tCal("views.month"),
                date: tCal("date"),
                time: tCal("time"),
                event: tCal("event"),
                noEventsInRange: tCal("noEventsInRange"),
                goTo: tCal("goTo"),
                scrollToTime: tCal("scrollToTime"),
                go: tCal("go"),
              }}
            />
          ) : (
            <BookingsPageClient
              rows={rows}
              total={bookingsTotal}
              page={tablePage}
              limit={tableLimit}
              pageSizeOptions={pageSizeOptions}
              sortKey={sort.key}
              sortDir={sort.dir}
              locale={locale}
              empty={hasFilters ? t("table.empty") : t("table.listEmpty")}
              emptyHint={hasFilters ? undefined : t("table.listEmptyHint")}
              workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
            />
          )}
        </>
      </BookingsPendingShell>

      {/* ?detail / ?edit modals mount client-side: no RSC round-trip to open/close. */}
      <BookingUrlModals
        locale={locale}
        teams={teamOptions}
        writableTeams={writableTeams}
        businessComplete={businessComplete}
        workspaceId={workspace._id.toString()}
        view={view}
        defaultCurrency={workspace.currency as SupportedCurrency}
        workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
      />
    </div>
  );
}
