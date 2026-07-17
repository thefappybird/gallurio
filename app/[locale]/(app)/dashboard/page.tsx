import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import type { BookingDoc } from "@/lib/db/models";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";
import { resolveStoredDashboardTab } from "@/lib/dashboard-preferences.server";
import { parseDashboardRange } from "@/lib/dashboard/date-range";
import { resolveWorkspaceTimezone } from "@/lib/utils/timezone";
import {
  getKpiSnapshotWithDeltas,
  getTodaysEvents,
  getUpcomingWeek,
  getActivityFeed,
  getRevenueTrend,
  getBookingsByDay,
  getTransactionsByTeam,
  getBookingsCountByTeam,
  getTopClients,
  type DateRange,
} from "./_data/dashboard-metrics";
import {
  getEventTypeValueTrend,
  getBookedHoursHeatmap,
  getScheduledVsCollectedSeries,
  getCollectionCoverage,
} from "./_data/booking-analytics";
import { KpiStrip } from "./_components/kpi-strip";
import { TodaysEventsList } from "./_components/todays-events-list";
import { UpcomingWeekList } from "./_components/upcoming-week-list";
import { ActivityFeed } from "./_components/activity-feed";
import { QuickAdd } from "./_components/quick-add";
import { RevenueTrendChart } from "./_components/revenue-trend-chart";
import { MiniBookingCalendar } from "./_components/mini-booking-calendar";
import { TopClientsBar } from "./_components/top-clients-bar";
import { TeamPerformanceCards } from "./_components/team-performance-cards";
import { BookingValueCollectionChart } from "./_components/booking-value-collection-chart";
import { CollectionCoverageCard } from "./_components/collection-coverage-card";
import { BookedHoursHeatmap } from "./_components/booked-hours-heatmap";
import { BookingEventTypeTrendChart } from "./_components/booking-event-type-trend-chart";
import { DashboardPendingShell } from "./_components/dashboard-pending-shell";
import { PortfolioDashboard } from "./_components/portfolio-dashboard";
import { getBookingTeamOptions } from "../bookings/_data/team-options";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.sidebar");
  return { title: t("dashboard") };
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.dashboard");

  const [{ role, userId, workspace }, authUser] = await Promise.all([
    requireOrg(),
    getAuthUser(),
  ]);
  // Dashboard is owner-only; members never see the nav link, and a direct URL
  // hit must 404 rather than leak workspace metrics.
  if (role !== "owner") notFound();
  const wid = workspace._id;

  await connectDB();

  const sp = await searchParams;
  const tab = await resolveStoredDashboardTab(
    typeof sp.tab === "string" ? sp.tab : undefined
  );
  const tz = resolveWorkspaceTimezone(workspace);
  const range = parseDashboardRange(sp, tz);

  // Workspace-local current period — picker defaults + future-date cap.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD

  const ownerFirstName = (authUser?.name ?? "").split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-3">
      <DashboardPendingShell
        greeting={
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("greeting", { name: ownerFirstName })}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {new Date().toLocaleDateString(locale, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        }
        today={today}
        currentMonth={today.slice(0, 7)}
        currentYear={Number(today.slice(0, 4))}
        tab={tab}
      >
        {tab === "portfolio" ? (
          <PortfolioDashboard workspace={workspace} locale={locale} range={range} />
        ) : (
          <BookingsTab
            wid={wid}
            workspace={workspace}
            locale={locale}
            t={t}
            role={role}
            userId={userId}
            range={range}
          />
        )}
      </DashboardPendingShell>
    </div>
  );
}

// Bookings tab kept inline so only the active tab runs its queries. Phase 4
// threads the date filter into the loaders.
async function BookingsTab({
  wid,
  workspace,
  locale,
  t,
  role,
  userId,
  range,
}: {
  wid: import("mongoose").Types.ObjectId;
  workspace: Awaited<ReturnType<typeof requireOrg>>["workspace"];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  role: "owner" | "staff";
  userId: string;
  range: DateRange;
}) {
  const timeMode = await getUserTimeFormat();
  const tz = resolveWorkspaceTimezone(workspace);

  const [
    kpi,
    todays,
    upcoming,
    activity,
    revenue,
    monthBookings,
    revenueByTeam,
    bookingsByTeam,
    topClients,
    teamOptions,
    valueSeries,
    coverage,
    heatmap,
    eventTrend,
  ] = await Promise.all([
    getKpiSnapshotWithDeltas(wid, range),
    getTodaysEvents(wid),
    getUpcomingWeek(wid),
    getActivityFeed(wid, 20),
    getRevenueTrend(wid, 30, range, tz),
    getBookingsByDay(wid, new Date()),
    getTransactionsByTeam(wid, range),
    getBookingsCountByTeam(wid, range),
    getTopClients(wid, 5),
    getBookingTeamOptions({ role, userId, workspace }),
    getScheduledVsCollectedSeries(wid, range, tz),
    getCollectionCoverage(wid, range),
    getBookedHoursHeatmap(wid, range, tz),
    getEventTypeValueTrend(wid, range, tz),
  ]);

  const eventTypeLabels = t.raw("eventTypes") as Record<string, string>;
  const weekdayLabels = t.raw("booking.heatmap.weekdays") as string[];
  const heatmapLegend = t.raw("booking.heatmap.legend") as string[];

  return (
    <div className="flex flex-col gap-3">
      <KpiStrip
        snapshot={kpi.snapshot}
        trends={kpi.trends}
        currency={workspace.currency}
        locale={locale}
        labels={{
          revenueThisMonth: t("kpi.revenueThisMonth"),
          activeBookings: t("kpi.activeBookings"),
          newInquiries: t("kpi.newInquiries"),
          outstandingBalance: t("kpi.outstandingBalance"),
        }}
      />

      {/* Scheduled value + collected (2/3) | Collection coverage (1/3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BookingValueCollectionChart
            data={valueSeries}
            currency={workspace.currency}
            locale={locale}
            labels={{
              title: t("booking.valueCollection.title"),
              bookedValue: t("booking.valueCollection.bookedValue"),
              collectedRevenue: t("booking.valueCollection.collectedRevenue"),
              empty: t("empty"),
            }}
          />
        </div>
        <CollectionCoverageCard
          coverage={coverage}
          currency={workspace.currency}
          locale={locale}
          labels={{
            title: t("booking.coverage.title"),
            asOf: t("booking.coverage.asOf"),
            confirmedValue: t("booking.coverage.confirmedValue"),
            confirmedHint: t("booking.coverage.confirmedHint"),
            paid: t("booking.coverage.paid"),
            paidHint: t("booking.coverage.paidHint"),
            remaining: t("booking.coverage.remaining"),
            remainingHint: t("booking.coverage.remainingHint"),
            // Raw: contains a literal {pct} token the card substitutes itself (no ICU).
            coverage: t.raw("booking.coverage.coverageText") as string,
            empty: t("empty"),
          }}
        />
      </div>

      {/* Booked-hours heatmap (2/3) | Event-type trend (1/3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BookedHoursHeatmap
            cells={heatmap}
            locale={locale}
            labels={{
              title: t("booking.heatmap.title"),
              weekOf: t("booking.heatmap.weekOf"),
              bookedHours: t("booking.heatmap.bookedHours"),
              weekdays: weekdayLabels,
              legend: heatmapLegend,
              empty: t("empty"),
            }}
          />
        </div>
        <BookingEventTypeTrendChart
          trend={eventTrend}
          currency={workspace.currency}
          locale={locale}
          labels={{
            title: t("booking.trend.title"),
            eventTypes: eventTypeLabels,
            empty: t("empty"),
          }}
        />
      </div>

      <TeamPerformanceCards
        revenueByTeam={revenueByTeam}
        bookingsByTeam={bookingsByTeam}
        currency={workspace.currency}
        locale={locale}
      />

      {/* Analytics extras: collected-cash trend (2/3) + top clients (1/3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 h-full">
          <RevenueTrendChart
            data={revenue}
            currency={workspace.currency}
            locale={locale}
            title={t("sections.revenueTrend")}
          />
        </div>
        <TopClientsBar
          clients={topClients}
          currency={workspace.currency}
          locale={locale}
          title={t("sections.topClients")}
          empty={t("empty")}
        />
      </div>

      {/* Operations — day-to-day tools, separated from analytics */}
      <section className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
        <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
          {t("sections.operations")}
        </h2>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2 h-full">
            <MiniBookingCalendar
              month={new Date()}
              days={monthBookings}
              locale={locale}
              title={t("sections.calendar")}
              teams={teamOptions}
            />
          </div>
          <QuickAdd
            title={t("quickAdd.title")}
            labels={{
              booking: t("quickAdd.booking"),
              client: t("quickAdd.client"),
              inquiry: t("quickAdd.inquiry"),
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2 h-full">
            <TodaysEventsList
              bookings={todays as BookingDoc[]}
              locale={locale}
              title={t("sections.todaysEvents")}
              empty={t("empty")}
              timeMode={timeMode}
            />
          </div>
          <div className="h-full lg:row-span-2">
            <UpcomingWeekList
              bookings={upcoming as BookingDoc[]}
              locale={locale}
              title={t("sections.upcomingWeek")}
              empty={t("empty")}
              viewAll={t("viewAll")}
            />
          </div>
          <div className="lg:col-span-2 h-full">
            <ActivityFeed
              activity={activity}
              locale={locale}
              title={t("sections.activity")}
              empty={t("empty")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
