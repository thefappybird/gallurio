import { NextResponse } from "next/server";
import { releaseExpiredInviteSeats } from "@/lib/db/jobs/release-expired-invite-seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron hits this route hourly (configured in vercel.json/cron).
// Auth model: Vercel injects `Authorization: Bearer ${CRON_SECRET}` for
// scheduled invocations; we reject anything else so manual hits from the
// internet 401 instead of running the job.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await releaseExpiredInviteSeats();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    console.error("[release-expired-invite-seats] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
