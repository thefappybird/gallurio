import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Client } from "@/lib/db/models";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { listBookings } from "./_data/bookings-queries";
import { ViewToggle, type BookingsView } from "./_components/view-toggle";
import { CalendarView } from "./_components/calendar-view";
import { BookingsToolbar } from "./_components/bookings-toolbar";
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

  // Fetch only the clients referenced by these bookings — keeps email lookup
  // cheap and avoids loading the full workspace client list.
  const clientIds = Array.from(
    new Set(bookings.map((b) => b.clientId?.toString()).filter(Boolean))
  );
  const clientEmails =
    clientIds.length > 0
      ? await Client.find({
          _id: { $in: clientIds },
          workspaceId: workspace._id,
        })
          .select({ _id: 1, email: 1 })
          .lean()
      : [];
  const emailByClientId = new Map(
    clientEmails.map((c) => [c._id.toString(), c.email ?? null])
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
    return {
      id: b._id.toString(),
      title: b.title,
      clientName: b.clientName,
      sessions: bSessions.map((s) => ({
        startAt: new Date(s.startAt).toISOString(),
        endAt: new Date(s.endAt).toISOString(),
      })),
      status: b.status as BookingStatus,
      total: b.amount?.total ?? 0,
      currency: b.amount?.currency ?? workspace.currency,
    };
  });

  const defaultDate = sp.date ? new Date(sp.date) : new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <ViewToggle view={view} />
      </div>

      <BookingsToolbar defaultCurrency={workspace.currency ?? "PHP"} />

      {view === "calendar" ? (
        <CalendarView
          events={events}
          defaultDate={defaultDate}
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
        <BookingsTable rows={rows} locale={locale} empty={t("table.empty")} />
      )}

      {sp.detail ? (
        <BookingDetailModal bookingId={sp.detail} locale={locale} />
      ) : null}

      {sp.add === "1" ? (
        <BookingWizardModal
          mode="create"
          defaultDate={sp.date}
          defaultTime={sp.time}
          defaultCurrency={workspace.currency as SupportedCurrency}
          locale={locale}
        />
      ) : null}

      {sp.edit ? (
        <BookingWizardModal
          mode="edit"
          bookingId={sp.edit}
          defaultCurrency={workspace.currency as SupportedCurrency}
          locale={locale}
        />
      ) : null}
    </div>
  );
}
