import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { releaseExpiredInviteSeats } from "@/lib/db/jobs/release-expired-invite-seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Constant-time string compare so the bearer-token check does not leak the
// secret's length or prefix through response-timing differences. Hashing
// both sides to a fixed 32-byte digest first means timingSafeEqual never
// takes the differing-length short-circuit that would otherwise leak length.
function safeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

// Hetzner deploy: a systemd timer (deploy/systemd/gallurio-invite-seats.timer,
// hourly) curls this route with `Authorization: Bearer ${CRON_SECRET}` — see
// deploy/systemd/gallurio-invite-seats.service and
// docs/modules/hosting-ops.md for install steps. Not a Vercel
// Cron target (this app is not deployed on Vercel). We reject any request
// without a matching bearer token so manual hits from the internet 401
// instead of running the job.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${expected}`)) {
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
