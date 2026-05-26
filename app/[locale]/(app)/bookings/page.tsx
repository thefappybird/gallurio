import { requireOrg } from "@/lib/auth/requireOrg";
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
  BookingsTable,
  type BookingRow,
} from "./_components/bookings-table";
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

  const { workspace } = await requireOrg();
  await connectDB();

  const sp = await searchParams;
  const view: BookingsView = sp.view === "calendar" ? "calendar" : "table";

  const bookings = await listBookings(workspace._id, {
    status: sp.status ?? null,
    q: sp.q ?? null,
    from: sp.from ? new Date(sp.from) : null,
    to: sp.to ? new Date(sp.to) : null,
    includeCancelled: sp.includeCancelled === "1",
  });

  // Fetch all clients for the workspace — used by the booking wizard's
  // client picker. Limit 1000 covers all realistic workspace sizes and avoids
  // per-keystroke API calls in the modal.
  const allClients = await Client.find({ workspaceId: workspace._id })
    .select({ _id: 1, name: 1, email: 1, phone: 1 })
    .sort({ name: 1 })
    .limit(1000)
    .lean();
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
  const events: CalendarEvent[] = bookings.flatMap((b) => {
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
      const found = await getBookingById(workspace._id, sp.detail);
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
            jumpTo: tCal("jumpTo"),
            scrollToTime: tCal("scrollToTime"),
            go: tCal("go"),
          }}
        />
      ) : (
        <BookingsTable
          rows={rows}
          locale={locale}
          empty={t("table.empty")}
          showPast={sp.showPast === "1"}
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
