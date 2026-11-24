import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { listDiscoverPortfolios } from "@/lib/db/queries/discover";
import { getClientIp } from "@/lib/server/getClientIp";
import { rateLimit } from "@/lib/server/rateLimit";
import { BUSINESS_TYPE_VALUES } from "@/lib/validators/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const CATEGORIES = BUSINESS_TYPE_VALUES.filter((v) => v !== "other") as [
  Exclude<(typeof BUSINESS_TYPE_VALUES)[number], "other">,
  ...Exclude<(typeof BUSINESS_TYPE_VALUES)[number], "other">[],
];

const querySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(60).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

// No edge WAF on Hetzner (docs/modules/hosting-ops.md, "Endpoint hardening"):
// per-IP cap on this public, DB-backed read.
const IP_RATE = { limit: 120, windowMs: 60_000 };

export async function GET(req: Request): Promise<Response> {
  const limit = rateLimit(`discover:${getClientIp(req.headers)}`, IP_RATE);
  if (!limit.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const params = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({
    category: params.get("category") ?? undefined,
    q: params.get("q") ?? undefined,
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400, headers: NO_STORE });
  }
  try {
    const page = await listDiscoverPortfolios(parsed.data);
    return NextResponse.json(page, { status: 200, headers: NO_STORE });
  } catch (err) {
    console.error("[discover] list failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }
}
