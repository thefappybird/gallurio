import { getTranslations } from "next-intl/server";
import {
  UsersIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  CalendarCheckIcon,
  ExternalLinkIcon,
  PencilIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/i18n/navigation";
import { resolveWorkspaceTimezone } from "@/lib/utils/timezone";
import type { InquiryDoc, WorkspaceDoc } from "@/lib/db/models";
import {
  getAnalyticsTotals,
  getVisitorInquirySeries,
  getInquiryPipeline,
  getContactFunnel,
  getDemandProfile,
  type DateRange,
} from "../_data/portfolio-analytics";
import { getRecentInquiries } from "../_data/dashboard-metrics";
import { RecentInquiriesList } from "./recent-inquiries-list";
import { PortfolioVisitorsInquiriesChart } from "./portfolio-visitors-inquiries-chart";
import { PortfolioConversionFunnelCard } from "./portfolio-conversion-funnel-card";
import { PortfolioLeadPipelineCard } from "./portfolio-lead-pipeline-card";
import { PortfolioDemandProfileCard } from "./portfolio-demand-profile-card";
import { DashboardInfoHint } from "./dashboard-info-hint";

type Props = {
  workspace: WorkspaceDoc;
  locale: string;
  range: DateRange;
};

function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint: string;
}) {
  return (
    <Card className="rounded-[var(--radius)] border-border">
      <CardContent className="flex items-center gap-3 px-3 py-2">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] border border-brand/30 bg-brand-4 text-brand">
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
            <DashboardInfoHint hint={hint} />
          </span>
          <span className="text-xl font-semibold tracking-tight">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export async function PortfolioDashboard({ workspace, locale, range }: Props) {
  const t = await getTranslations("app.dashboard");
  const wid = workspace._id;
  const tz = resolveWorkspaceTimezone(workspace);

  const [totals, series, pipeline, funnel, demand, inquiries] = await Promise.all([
    getAnalyticsTotals(wid, range),
    getVisitorInquirySeries(wid, range, tz),
    getInquiryPipeline(wid, range),
    getContactFunnel(wid, range),
    getDemandProfile(wid, range, tz),
    getRecentInquiries(wid, 5),
  ]);

  const nf = new Intl.NumberFormat(locale);
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const publishedAt = workspace.publicPage?.publishedAt
    ? new Date(workspace.publicPage.publishedAt as unknown as Date)
    : null;

  const eventTypes = t.raw("eventTypes") as Record<string, string>;

  return (
    <div className="flex flex-col gap-3">
      {/* KPI strip: Visitor-days | Inquiries | Submission rate | Booked leads */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("portfolio.visitorDays")} value={nf.format(totals.visitors)} icon={UsersIcon} hint="portfolioKpi" />
        <MetricCard label={t("portfolio.inquiries")} value={nf.format(totals.inquiries)} icon={MessageSquareIcon} hint="portfolioKpi" />
        <MetricCard
          label={t("portfolio.submissionRate")}
          value={pct.format(totals.conversionRate)}
          icon={TrendingUpIcon}
          hint="portfolioKpi"
        />
        <MetricCard label={t("portfolio.bookedLeads")} value={nf.format(pipeline.booked)} icon={CalendarCheckIcon} hint="portfolioKpi" />
      </div>

      {/* Visitors + inquiries over time (2/3) | Conversion funnel (1/3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="rounded-[var(--radius)] lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">{t("portfolio.visitorsInquiriesTitle")}</CardTitle>
            <DashboardInfoHint hint="portfolioVisitorsInquiries" />
          </CardHeader>
          <CardContent className="h-56 p-0 pr-2">
            <PortfolioVisitorsInquiriesChart
              data={series}
              locale={locale}
              labels={{
                visitors: t("portfolio.visitors"),
                inquiries: t("portfolio.inquiries"),
                empty: t("portfolio.noTraffic"),
              }}
            />
          </CardContent>
        </Card>

        <PortfolioConversionFunnelCard
          funnel={funnel}
          locale={locale}
          labels={{
            title: t("portfolio.funnel.title"),
            visitorDays: t("portfolio.funnel.visitorDays"),
            contactOpened: t("portfolio.funnel.contactOpened"),
            inquirySubmitted: t("portfolio.funnel.inquirySubmitted"),
            ofVisitors: t("portfolio.funnel.ofVisitors"),
            ofOpened: t("portfolio.funnel.ofOpened"),
            ofTotal: t("portfolio.funnel.ofTotal"),
            collectingData: t("portfolio.funnel.collectingData"),
            empty: t("portfolio.noTraffic"),
          }}
        />
      </div>

      {/* Inquiry pipeline (1/3) | Demand profile (2/3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PortfolioLeadPipelineCard
          pipeline={pipeline}
          locale={locale}
          labels={{
            title: t("portfolio.pipeline.title"),
            new: t("portfolio.pipeline.new"),
            booked: t("portfolio.pipeline.booked"),
            archived: t("portfolio.pipeline.archived"),
            total: t("portfolio.pipeline.total"),
            empty: t("empty"),
          }}
        />
        <div className="lg:col-span-2">
          <PortfolioDemandProfileCard
            profile={demand}
            locale={locale}
            labels={{
              title: t("portfolio.demand.title"),
              eventTypeMix: t("portfolio.demand.eventTypeMix"),
              requestedMonth: t("portfolio.demand.requestedMonth"),
              medianLeadTime: t("portfolio.demand.medianLeadTime"),
              days: t("portfolio.demand.days"),
              basedOn: t("portfolio.demand.basedOn"),
              empty: t("empty"),
              eventTypes,
            }}
          />
        </div>
      </div>

      {/* Recent inquiries (current) + portfolio status actions */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentInquiriesList
            inquiries={inquiries as InquiryDoc[]}
            locale={locale}
            title={t("portfolio.siteInquiries")}
            empty={t("empty")}
            viewAll={t("viewAll")}
          />
        </div>

        <Card className="rounded-[var(--radius)]">
          <CardHeader className="pb-3 flex justify-between">
            <span className="flex items-center gap-1.5"><CardTitle className="text-sm font-medium">{t("portfolio.publishStatus")}</CardTitle><DashboardInfoHint hint="portfolioPublishStatus" /></span>
            <span
              className={`inline-flex w-fit items-center rounded-[var(--radius)] px-2 py-0.5 text-[11px] font-medium ${
                publishedAt ? "bg-[var(--event-completed)] text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {publishedAt ? t("portfolio.published") : t("portfolio.notPublished")}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {publishedAt && (
              <span className="text-xs text-muted-foreground">
                {t("portfolio.lastPublished", {
                  date: publishedAt.toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }),
                })}
              </span>
            )}
            <div className="mt-1 flex flex-col gap-1">
              <a
                href={`/w/${workspace.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLinkIcon className="size-4" />
                {t("portfolio.viewLive")}
              </a>
              <Link
                href="/portfolio"
                className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <PencilIcon className="size-4" />
                {t("portfolio.openEditor")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
