import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";
import { getShiftsOnDate, getShiftsOnDates } from "@/lib/bookings/shift-conflicts";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATES = 31;

/**
 * Returns shifts in the workspace that touch the given date. A shift "touches"
 * the date if any session's range overlaps [dayStart, dayEnd]. Returns the
 * shift-start and shift-end times (HH:MM, local) from the matching session so
 * the wizard can show conflict ranges without leaking full booking details.
 */
export async function GET(req: Request) {
  const ctx = await requireOrg();
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const datesParam = url.searchParams.get("dates");

  // Exactly one of `date` (single) / `dates` (batched, comma-separated).
  if ((dateParam === null) === (datesParam === null)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  let dates: string[] | null = null;
  if (datesParam !== null) {
    dates = [...new Set(datesParam.split(","))];
    if (dates.length > MAX_DATES) {
      return NextResponse.json({ error: "Too many dates" }, { status: 400 });
    }
    if (!dates.every((d) => DATE_RE.test(d))) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
  } else if (!dateParam || !DATE_RE.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const excludeId = url.searchParams.get("excludeId");
  const excludeShiftKey = url.searchParams.get("excludeShiftKey");

  await connectDB();
  const scope = await resolveBookingTeamScope(ctx);

  // Resolve workspace timezone — fall back to Manila (launch market) if not set.
  const tz: string =
    (ctx.workspace as { timezone?: string | null }).timezone ||
    (() => {
      console.warn(
        `[shifts-on-date] workspace ${ctx.workspace._id} has no timezone set; defaulting to ${FALLBACK_TZ}`
      );
      return FALLBACK_TZ;
    })();

  if (dates) {
    const byDate = await getShiftsOnDates(ctx.workspace._id, dates, tz, {
      excludeId,
      excludeShiftKey,
      teamScope: scope,
    });
    return NextResponse.json({ byDate });
  }

  const shifts = await getShiftsOnDate(ctx.workspace._id, dateParam!, tz, {
    excludeId,
    excludeShiftKey,
    teamScope: scope,
  });

  return NextResponse.json({ shifts });
}
