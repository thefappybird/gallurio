import "server-only";
import { NextResponse } from "next/server";
import { getDiscoverPortfolio } from "@/lib/db/queries/discover";
import { getClientIp } from "@/lib/server/getClientIp";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Same per-IP budget as the list route (shared `discover:${ip}` key): no edge
// WAF on Hetzner, see docs/modules/hosting-ops.md "Endpoint hardening".
const IP_RATE = { limit: 120, windowMs: 60_000 };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const limit = rateLimit(`discover:${getClientIp(req.headers)}`, IP_RATE);
  if (!limit.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const slug = (await params).slug.trim().toLowerCase();
  const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  if (slug.length === 0 || slug.length > 100) return notFound();

  try {
    const detail = await getDiscoverPortfolio(slug);
    if (!detail) return notFound();
    return NextResponse.json(detail, { status: 200, headers: NO_STORE });
  } catch (err) {
    console.error("[discover] detail failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }
}
