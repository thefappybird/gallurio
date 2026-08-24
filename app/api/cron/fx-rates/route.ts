import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { refreshFxRateTable } from "@/lib/pricing/fxRates";

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

// Hetzner deploy: a systemd timer (deploy/systemd/gallurio-fx-rates.timer,
// daily at 00:15 UTC) curls this route with `Authorization: Bearer
// ${CRON_SECRET}` — see deploy/systemd/gallurio-fx-rates.service and
// docs/pricing/currency-conversion.md for install steps. Auth model mirrors
// billing-lifecycle: reject anything without a matching bearer token so
// manual hits from the internet 401 instead of running the job.
//
// This is the only steady-state caller of Open Exchange Rates — the request
// path (lib/pricing/fxRates.ts) reads the table this writes and only falls
// back to its own fetch if a day's run here never happened.
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
    const rates = await refreshFxRateTable();
    if (!rates) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, currencies: Object.keys(rates).length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    console.error("[fx-rates-cron] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
