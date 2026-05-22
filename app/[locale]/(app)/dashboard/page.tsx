import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, Inquiry } from "@/lib/db/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, UsersIcon, MessageSquareIcon, BookOpenIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/lib/i18n/navigation";

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.dashboard");

  const { workspace } = await requireOrg();
  const wid = workspace._id;

  await connectDB();

  const now = new Date();

  const [totalBookings, activeClients, newInquiries, upcomingBookings] =
    await Promise.all([
      Booking.countDocuments({ workspaceId: wid }),
      Client.countDocuments({ workspaceId: wid }),
      Inquiry.countDocuments({ workspaceId: wid, status: "new" }),
      Booking.find({
        workspaceId: wid,
        status: { $in: ["booked", "inquiry", "quoted"] },
        startAt: { $gte: now },
      })
        .sort({ startAt: 1 })
        .limit(5)
        .lean(),
    ]);

  const stats = [
    { label: t("stats.totalBookings"), value: totalBookings, icon: BookOpenIcon },
    { label: t("stats.activeClients"), value: activeClients, icon: UsersIcon },
    { label: t("stats.newInquiries"), value: newInquiries, icon: MessageSquareIcon },
    { label: t("stats.eventsThisMonth"), value: 0, icon: CalendarIcon },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("upcoming.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("upcoming.empty")}{" "}
              <Link href="/bookings/new" className="underline underline-offset-2">
                {t("upcoming.createOne")}
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcomingBookings.map((b) => (
                <li
                  key={String(b._id)}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{b.title}</span>
                    <span className="text-muted-foreground">
                      {new Date(b.startAt).toLocaleDateString(locale, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <Badge variant="secondary">{b.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
