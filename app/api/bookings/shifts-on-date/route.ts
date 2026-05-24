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

  // Any booking with a session (or legacy firstSessionStart/lastSessionEnd)
  // whose range overlaps [dayStart, dayEnd].
  const filter: Record<string, unknown> = {
    workspaceId: ctx.workspace._id,
    status: { $ne: "cancelled" },
    $or: [
      {
        sessions: {
          $elemMatch: {
            startAt: { $lte: dayEnd },
            endAt: { $gte: dayStart },
          },
        },
      },
      {
        firstSessionStart: { $lte: dayEnd },
        lastSessionEnd: { $gte: dayStart },
      },
    ],
  };
  if (excludeId && /^[a-f0-9]{24}$/i.test(excludeId)) {
    filter._id = { $ne: excludeId };
  }

  const bookings = await Booking.find(filter)
    .select({ _id: 1, title: 1, sessions: 1, firstSessionStart: 1, lastSessionEnd: 1 })
    .sort({ firstSessionStart: 1 })
    .limit(20)
    .lean();

  type RawBooking = typeof bookings[number] & {
    firstSessionStart?: Date;
    lastSessionEnd?: Date;
  };

  const shifts = (bookings as RawBooking[]).flatMap((b) => {
    const sessions = b.sessions as { startAt: Date; endAt: Date }[] | undefined;
    const matchingSession = sessions?.find(
      (s) => s.startAt <= dayEnd && s.endAt >= dayStart
    );

    // Fall back to denormalized bounds for legacy bookings missing sessions[].
    const startDate = matchingSession
      ? new Date(matchingSession.startAt)
      : b.firstSessionStart
        ? new Date(b.firstSessionStart)
        : null;
    const endDate = matchingSession
      ? new Date(matchingSession.endAt)
      : b.lastSessionEnd
        ? new Date(b.lastSessionEnd)
        : null;

    if (!startDate || !endDate) return [];
    return [
      {
        id: b._id.toString(),
        title: b.title,
        shiftStart: `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
        shiftEnd: `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`,
      },
    ];
  });

  return NextResponse.json({ shifts });
}
