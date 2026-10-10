import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/db/models";
import { loadBookingActivityPage } from "@/lib/bookings/activity-page";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;

export async function GET(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(
    1,
    Math.min(
      MAX_PAGE_SIZE,
      Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE
    )
  );

  await connectDB();
  const scope = await resolveBookingTeamScope(ctx);

  // Ownership guard — confirms workspace scope and (for non-owners) team scope
  // before returning any activity. A member cannot read activity for a booking
  // outside their teams.
  const bookingFilter: Record<string, unknown> = { _id: id, workspaceId: ctx.workspace._id };
  if (scope !== undefined) bookingFilter.teamId = { $in: scope };
  const exists = await Booking.exists(bookingFilter);
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    await loadBookingActivityPage(ctx.workspace._id, id, page, pageSize)
  );
}
