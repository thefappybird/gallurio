import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/db/models";

export const runtime = "nodejs";

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
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Exclude a booking from the results — used in edit mode so the wizard
  // doesn't flag the user's own current booking as a conflict.
  const excludeId = url.searchParams.get("excludeId");

  await connectDB();

  // Day boundaries in LOCAL time (server clock).
  const [y, m, d] = dateParam.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  // Any booking with a session whose range overlaps [dayStart, dayEnd].
  const filter: Record<string, unknown> = {
    workspaceId: ctx.workspace._id,
    status: { $ne: "cancelled" },
    sessions: {
      $elemMatch: {
        startAt: { $lte: dayEnd },
        endAt: { $gte: dayStart },
      },
    },
  };
  if (excludeId && /^[a-f0-9]{24}$/i.test(excludeId)) {
    filter._id = { $ne: excludeId };
  }

  const bookings = await Booking.find(filter)
    .select({ _id: 1, title: 1, sessions: 1 })
    .sort({ firstSessionStart: 1 })
    .limit(20)
    .lean();

  const shifts = bookings.flatMap((b) => {
    // Return the shift times from the session that actually overlaps this day.
    const matchingSession = (b.sessions as { startAt: Date; endAt: Date }[]).find(
      (s) => s.startAt <= dayEnd && s.endAt >= dayStart
    );
    if (!matchingSession) return [];
    const s = new Date(matchingSession.startAt);
    const e = new Date(matchingSession.endAt);
    return [
      {
        id: b._id.toString(),
        title: b.title,
        shiftStart: `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`,
        shiftEnd: `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`,
      },
    ];
  });

  return NextResponse.json({ shifts });
}
