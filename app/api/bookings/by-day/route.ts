import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { getBookingsByDay } from "@/app/[locale]/(app)/dashboard/_data/dashboard-metrics";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";
import { resolveRequestedTeamIds } from "@/lib/bookings/team-filter";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await requireOrg();
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const monthIdx = Number(url.searchParams.get("month")); // 0-11
  if (!Number.isFinite(year) || !Number.isFinite(monthIdx)) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }
  await connectDB();
  const scope = await resolveBookingTeamScope(ctx);
  // Optional ?team= narrows within (never widens past) the caller's scope.
  const teamIds = resolveRequestedTeamIds(url.searchParams.get("team"), scope);
  const days = await getBookingsByDay(
    ctx.workspace._id,
    new Date(year, monthIdx, 1),
    teamIds
  );
  return NextResponse.json(days);
}
