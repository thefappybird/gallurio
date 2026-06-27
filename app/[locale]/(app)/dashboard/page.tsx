import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import type {
  BookingDoc,
  InquiryDoc,
  ActivityLogDoc,
} from "@/lib/db/models";
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
  getRecentInquiries,
  getActivityFeed,
  getRevenueTrend,
  getBookingsByDay,
  getEventTypeBreakdown,
  getTransactionsByTeam,
  getBookingsCountByTeam,
  getTopClients,
  type DateRange,
} from "./_data/dashboard-metrics";
import { KpiStrip } from "./_components/kpi-strip";
import { TodaysEventsList } from "./_components/todays-events-list";
import { UpcomingWeekList } from "./_components/upcoming-week-list";
import { RecentInquiriesList } from "./_components/recent-inquiries-list";
import { ActivityFeed } from "./_components/activity-feed";
import { QuickAdd } from "./_components/quick-add";
import { RevenueTrendChart } from "./_components/revenue-trend-chart";
import { MiniBookingCalendar } from "./_components/mini-booking-calendar";
import { EventTypeDonut } from "./_components/event-type-donut";
import { TopClientsBar } from "./_components/top-clients-bar";
import { TeamPerformanceCards } from "./_components/team-performance-cards";
import { DashboardTabs } from "./_components/dashboard-tabs";
import { DashboardDateFilter } from "./_components/dashboard-date-filter";
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

  const { role, userId, workspace } = await requireOrg();
  // Dashboard is owner-only; members never see the nav link, and a direct URL
  // hit must 404 rather than leak workspace metrics.
  if (role !== "owner") notFound();
  const wid = workspace._id;

  await connectDB();

  const sp = await searchParams;
  const tab = await resolveStoredDashboardTab(
    typeof sp.tab === "string" ? sp.tab : undefined
  );
  const range = parseDashboardRange(sp, resolveWorkspaceTimezone(workspace));

  const ownerFirstName = workspace.name.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
        {/* One date filter for both dashboards, left of the tab switcher. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DashboardDateFilter />
          <DashboardTabs tab={tab} />
        </div>
      </div>

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

  const [
    kpi,
    todays,
    upcoming,
    inquiries,
    activity,
    revenue,
    monthBookings,
    eventTypes,
    revenueByTeam,
    bookingsByTeam,
    topClients,
    teamOptions,
  ] = await Promise.all([
    getKpiSnapshotWithDeltas(wid, range),
    getTodaysEvents(wid),
    getUpcomingWeek(wid),
    getRecentInquiries(wid),
    getActivityFeed(wid, 20),
    getRevenueTrend(wid, 30, range),
    getBookingsByDay(wid, new Date()),
    getEventTypeBreakdown(wid, range),
    getTransactionsByTeam(wid, range),
    getBookingsCountByTeam(wid, range),
    getTopClients(wid, 5),
    getBookingTeamOptions({ role, userId, workspace }),
  ]);

  return (
    <div className="flex flex-col gap-5">
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <MiniBookingCalendar
          month={new Date()}
          days={monthBookings}
          locale={locale}
          title={t("sections.calendar")}
          teams={teamOptions}
        />
        <EventTypeDonut
          data={eventTypes}
          title={t("sections.eventTypes")}
          empty={t("empty")}
        />
        <TopClientsBar
          clients={topClients}
          currency={workspace.currency}
          locale={locale}
          title={t("sections.topClients")}
          empty={t("empty")}
        />
      </div>

      <TeamPerformanceCards
        revenueByTeam={revenueByTeam}
        bookingsByTeam={bookingsByTeam}
        currency={workspace.currency}
        locale={locale}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 h-full">
          <RevenueTrendChart
            data={revenue}
            currency={workspace.currency}
            locale={locale}
            title={t("sections.revenueTrend")}
          />
        </div>
        <UpcomingWeekList
          bookings={upcoming as BookingDoc[]}
          locale={locale}
          title={t("sections.upcomingWeek")}
          empty={t("empty")}
          viewAll={t("viewAll")}
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
        <RecentInquiriesList
          inquiries={inquiries as InquiryDoc[]}
          locale={locale}
          title={t("sections.recentInquiries")}
          empty={t("empty")}
          viewAll={t("viewAll")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 h-full">
          <ActivityFeed
            activity={activity as ActivityLogDoc[]}
            locale={locale}
            title={t("sections.activity")}
            empty={t("empty")}
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
    </div>
  );
}
