import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runBillingLifecycleSweep } from "@/lib/db/jobs/billing-lifecycle-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Constant-time string compare so the bearer-token check does not leak the
// secret length/prefix through response-timing differences.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Vercel Cron hits this route daily (configured in vercel.json/cron). Auth
// model mirrors release-expired-invite-seats: Vercel injects
// Authorization: Bearer CRON_SECRET for scheduled invocations; reject
// anything else so manual hits from the internet 401 instead of running the
// job.
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
    const report = await runBillingLifecycleSweep();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    console.error("[billing-lifecycle-sweep] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
