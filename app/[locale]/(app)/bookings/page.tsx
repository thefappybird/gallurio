import { requireOrg } from "@/lib/auth/requireOrg";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";
import { getBookingTeamOptions } from "./_data/team-options";
import { connectDB } from "@/lib/db/mongoose";
import { Client } from "@/lib/db/models";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listBookings, getBookingById } from "./_data/bookings-queries";
import { ViewToggle, type BookingsView } from "./_components/view-toggle";
import { CalendarBookingManager } from "./_components/calendar-booking-manager";
import { TableBookingManager } from "./_components/table-booking-manager";
import {
  type BookingRow,
} from "./_components/bookings-table";
import { BookingsPageClient } from "./_components/bookings-page-client";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { BookingDetailModal } from "./_components/booking-detail-modal";
import { BookingWizardModal } from "./_components/booking-wizard-modal";
import type { CalendarEvent } from "./_components/booking-calendar";
import { splitSessionIntoCandles } from "@/lib/bookings/candle-split";
import type { BookingStatus } from "@/lib/validators/booking";
import type { SupportedCurrency } from "@/lib/validators/workspace";

type ClientHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

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
};

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.bookings");
  const tCal = await getTranslations("app.calendar");

  const { workspace, role, userId } = await requireOrg();
  await connectDB();

  // Team visibility: owners see the whole workspace; non-owners (staff) see only
  // bookings owned by teams they belong to. An empty membership list yields an
  // empty `teamIds` array → the query matches nothing (fail-closed).
  const allowedTeamIds = await resolveBookingTeamScope({ role, userId, workspace });

  const sp = await searchParams;
  const view: BookingsView = sp.view === "calendar" ? "calendar" : "table";

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

  // Parse pagination params (table view only).
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const tablePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedLimit = Number.parseInt(sp.limit ?? "10", 10);
  const tableLimit = PAGE_SIZE_OPTIONS.includes(parsedLimit) ? parsedLimit : 10;

  const filters = {
    status: sp.status ?? null,
    q: sp.q ?? null,
    from: sp.from ? new Date(sp.from) : null,
    to: sp.to ? new Date(sp.to) : null,
    includeCancelled: sp.includeCancelled === "1",
    // A team selection narrows within the caller's visibility scope; an empty
    // selection falls back to the full visibility scope (owner: undefined = all).
    teamIds: selectedTeamIds.length > 0 ? selectedTeamIds : allowedTeamIds,
  };

  // These two reads are independent — run them together to save a round-trip.
  //  - Calendar view: fetch all bookings (no pagination) for event splitting.
  //    Table view: fetch only one page of bookings.
  //  - All clients for the workspace power the booking wizard's client picker.
  //    Limit 1000 covers all realistic workspace sizes and avoids per-keystroke
  //    API calls in the modal.
  const [{ rows: bookings, total: bookingsTotal }, allClients] = await Promise.all([
    listBookings(
      workspace._id,
      filters,
      view === "table" ? { page: tablePage, limit: tableLimit } : undefined
    ),
    Client.find({ workspaceId: workspace._id })
      .select({ _id: 1, name: 1, email: 1, phone: 1 })
      .sort({ name: 1 })
      .limit(1000)
      .lean(),
  ]);

  // If the requested table page lies past the end of a non-empty result set
  // (stale bookmark, post-filter narrowing), redirect to the last valid page
  // rather than render an empty table whose footer claims rows exist.
  if (view === "table" && bookingsTotal > 0 && tablePage > 1) {
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

  const initialClients: ClientHit[] = allClients.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
  }));

  // Build a lookup map for email by client id — used for calendar event enrichment.
  const emailByClientId = new Map(
    allClients.map((c) => [c._id.toString(), c.email ?? null])
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Each session of each booking generates per-day candles. A candle covers
  // one calendar day within the session's date range, running at the session's
  // shift-start → shift-end time. Candle id encodes booking + session index +
  // date so each candle is unique and stable.
  // Only the calendar view consumes candle events; skip the split work in table
  // view (where `bookings` is a single page that would be discarded anyway).
  const events: CalendarEvent[] =
    view !== "calendar"
      ? []
      : bookings.flatMap((b) => {
          const bookingId = b._id.toString();
          const sessions = b.sessions as { startAt: Date; endAt: Date }[];

          return sessions.flatMap((session, sessionIdx) => {
            const sessionStart = new Date(session.startAt);
            const sessionEnd = new Date(session.endAt);

            const result = splitSessionIntoCandles(
              { startAt: sessionStart, endAt: sessionEnd },
              today
            );

            return result.candles.map((candle) => ({
              id: `${bookingId}_s${sessionIdx}_${candle.dayKey}`,
              bookingId,
              teamId: b.teamId ? String(b.teamId) : null,
              title: b.title,
              start: candle.start,
              end: candle.end,
              status: b.status as BookingStatus,
              clientName: b.clientName,
              clientEmail: emailByClientId.get(String(b.clientId)) ?? null,
              rangeStart: result.rangeStart,
              rangeEnd: result.rangeEnd,
              sessionIndex: sessionIdx,
              sessionStartAt: sessionStart,
              sessionEndAt: sessionEnd,
              sessionDayCount: result.totalShiftDays,
              sessionPastDayCount: result.pastShiftDays,
            }));
          });
        });

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
      status: b.status as BookingStatus,
      total: b.amount?.total ?? 0,
      currency: b.amount?.currency ?? workspace.currency,
    };
  });

  const defaultDate = sp.date ? new Date(sp.date) : new Date();

  // Defensive: if ?detail= is present but the booking doesn't exist (or is
  // not owned by this workspace), strip the param and redirect — prevents the
  // URL from staying broken after a delete, hard-reload, or bad link.
  if (sp.detail) {
    let detailExists = false;
    try {
      const found = await getBookingById(workspace._id, sp.detail, allowedTeamIds);
      detailExists = found !== null;
    } catch {
      // Invalid ObjectId format — treat as not found.
      detailExists = false;
    }
    if (!detailExists) {
      const cleanParams = new URLSearchParams(
        Object.entries(sp).filter(([k]) => k !== "detail") as [string, string][]
      );
      const qs = cleanParams.toString();
      redirect(qs ? `/${locale}/bookings?${qs}` : `/${locale}/bookings`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <ViewToggle view={view} />
      </div>

      {view !== "calendar" ? (
        // Table view: TableBookingManager owns the "New Booking" open state so
        // the button always fires even when ?add=1 is already in the URL.
        <TableBookingManager
          defaultCurrency={workspace.currency as SupportedCurrency}
          locale={locale}
          workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
          clients={initialClients}
          canCreate={canCreate}
          defaultTeamId={defaultTeamId}
          teams={teamOptions}
          selectedTeams={selectedTeamIds}
          writableTeams={writableTeams}
          isOwner={role === "owner"}
        />
      ) : null}

      {view === "calendar" ? (
        <CalendarBookingManager
          events={events}
          defaultDate={defaultDate}
          initialClients={initialClients}
          defaultCurrency={workspace.currency as SupportedCurrency}
          locale={locale}
          workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
          canCreate={canCreate}
          defaultTeamId={defaultTeamId}
          teams={teamOptions}
          selectedTeams={selectedTeamIds}
          writableTeams={writableTeams}
          isOwner={role === "owner"}
          colorMode={colorMode}
          teamColorMap={teamColorMap}
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
          locale={locale}
          empty={t("table.empty")}
          showPast={sp.showPast === "1"}
          workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
        />
      )}

      {sp.detail ? (
        <BookingDetailModal bookingId={sp.detail} locale={locale} />
      ) : null}

      {/* Table-view edit modal: URL-driven (row click sets ?edit=<id>). */}
      {view !== "calendar" && sp.edit ? (
        <BookingWizardModal
          mode="edit"
          bookingId={sp.edit}
          defaultCurrency={workspace.currency as SupportedCurrency}
          locale={locale}
          workspaceTimezone={(workspace as { timezone?: string | null }).timezone ?? undefined}
          clients={initialClients}
        />
      ) : null}
    </div>
  );
}
