import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import type {
  BookingDoc,
  InquiryDoc,
  ActivityLogDoc,
} from "@/lib/db/models";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import {
  getKpiSnapshot,
  getTodaysEvents,
  getUpcomingWeek,
  getRecentInquiries,
  getActivityFeed,
  getPipelineCounts,
  getRevenueTrend,
  getBookingsByDay,
  getEventTypeBreakdown,
  getTransactionsByMethod,
  getTransactionsByTeam,
  getBookingsByWeekday,
  getTopClients,
} from "./_data/dashboard-metrics";
import { KpiStrip } from "./_components/kpi-strip";
import { TodaysEventsList } from "./_components/todays-events-list";
import { UpcomingWeekList } from "./_components/upcoming-week-list";
import { RecentInquiriesList } from "./_components/recent-inquiries-list";
import { ActivityFeed } from "./_components/activity-feed";
import { QuickAdd } from "./_components/quick-add";
import { PipelineFunnel } from "./_components/pipeline-funnel";
import { RevenueTrendChart } from "./_components/revenue-trend-chart";
import { MiniBookingCalendar } from "./_components/mini-booking-calendar";
import { EventTypeDonut } from "./_components/event-type-donut";
import { TopClientsBar } from "./_components/top-clients-bar";
import { TransactionsByMethodBar } from "./_components/transactions-by-method-bar";
import { TransactionsByTeamBar } from "./_components/transactions-by-team-bar";
import { WeeklyBookingsBar } from "./_components/weekly-bookings-bar";

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

// Mock trends until we wire historical comparison. Keeps the visual story for now.
const MOCK_TRENDS = {
  revenue: { value: 12.4, positiveIsGood: true },
  activeBookings: { value: 5.1, positiveIsGood: true },
  newInquiries: { value: -2.3, positiveIsGood: true },
  outstandingBalance: { value: -8.6, positiveIsGood: false },
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.dashboard");

  const { workspace } = await requireOrg();
  const wid = workspace._id;

  await connectDB();

  const [
    snapshot,
    todays,
    upcoming,
    inquiries,
    activity,
    pipeline,
    revenue,
    monthBookings,
    eventTypes,
    txByMethod,
    txByTeam,
    weekly,
    topClients,
  ] = await Promise.all([
    getKpiSnapshot(wid),
    getTodaysEvents(wid),
    getUpcomingWeek(wid),
    getRecentInquiries(wid),
    getActivityFeed(wid),
    getPipelineCounts(wid),
    getRevenueTrend(wid, 30),
    getBookingsByDay(wid, new Date()),
    getEventTypeBreakdown(wid),
    getTransactionsByMethod(wid, 90),
    getTransactionsByTeam(wid, 90),
    getBookingsByWeekday(wid),
    getTopClients(wid, 5),
  ]);

  const ownerFirstName = workspace.name.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-6">
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

      <KpiStrip
        snapshot={snapshot}
        currency={workspace.currency}
        locale={locale}
        labels={{
          revenueThisMonth: t("kpi.revenueThisMonth"),
          activeBookings: t("kpi.activeBookings"),
          newInquiries: t("kpi.newInquiries"),
          outstandingBalance: t("kpi.outstandingBalance"),
        }}
        trends={MOCK_TRENDS}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MiniBookingCalendar
          month={new Date()}
          days={monthBookings}
          locale={locale}
          title={t("sections.calendar")}
        />
        <EventTypeDonut
          data={eventTypes}
          title={t("sections.eventTypes")}
          empty={t("empty")}
        />
        <TransactionsByMethodBar
          data={txByMethod}
          currency={workspace.currency}
          locale={locale}
          title={t("sections.transactionsByMethod")}
          empty={t("empty")}
        />
        {txByTeam.length > 1 && (
          <TransactionsByTeamBar
            data={txByTeam}
            currency={workspace.currency}
            locale={locale}
            title={t("sections.transactionsByTeam")}
            empty={t("empty")}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PipelineFunnel
          counts={pipeline}
          title={t("sections.pipeline")}
          labels={{
            inquiries: t("pipeline.inquiries"),
            quoted: t("pipeline.quoted"),
            booked: t("pipeline.booked"),
          }}
        />
        <WeeklyBookingsBar data={weekly} title={t("sections.weeklyBookings")} />
        <UpcomingWeekList
          bookings={upcoming as BookingDoc[]}
          locale={locale}
          title={t("sections.upcomingWeek")}
          empty={t("empty")}
          viewAll={t("viewAll")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 h-full">
          <TodaysEventsList
            bookings={todays as BookingDoc[]}
            locale={locale}
            title={t("sections.todaysEvents")}
            empty={t("empty")}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
