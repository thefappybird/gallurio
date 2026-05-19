import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, Inquiry } from "@/lib/db/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, UsersIcon, MessageSquareIcon, BookOpenIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { workspace } = await requireOrg();
  const wid = workspace._id;

  await connectDB();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
    { label: "Total bookings", value: totalBookings, icon: BookOpenIcon },
    { label: "Active clients", value: activeClients, icon: UsersIcon },
    { label: "New inquiries", value: newInquiries, icon: MessageSquareIcon },
    { label: "Events this month", value: 0, icon: CalendarIcon },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Here&apos;s what&apos;s happening today.</p>
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
          <CardTitle className="text-base">Upcoming bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No upcoming bookings yet.{" "}
              <a href="/bookings/new" className="underline underline-offset-2">
                Create one
              </a>
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
                      {new Date(b.startAt).toLocaleDateString(undefined, {
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
