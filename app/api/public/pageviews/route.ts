import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { rateLimit } from "@/lib/server/rateLimit";
import { resolveWorkspaceIdBySlug } from "@/lib/db/queries/publicPage";
import { resolveWorkspaceTimezone, localDayStart } from "@/lib/utils/timezone";
import {
  visitorHash,
  classifySource,
  isBotUserAgent,
  PAGEVIEW_PAGES,
} from "@/lib/analytics/pageview";
import { recordPageview } from "@/lib/analytics/recordPageview";
import { getClientIp } from "@/lib/server/getClientIp";

// Public, unauthenticated write — Node runtime (Mongo). Must never 500 the page.
export const runtime = "nodejs";

const NO_CONTENT = () => new Response(null, { status: 204 });

// Layered abuse control (no edge WAF on Hetzner): a per-IP bucket plus a tighter
// per-(IP, slug, page) cap so one client can't inflate a single counter. The
// reverse proxy adds the production ceiling.
const IP_RATE = { limit: 60, windowMs: 60_000 };
const PAGE_RATE = { limit: 10, windowMs: 60_000 };

const beaconSchema = z.object({
  orgSlug: z.string().trim().min(1).max(64),
  page: z.enum(PAGEVIEW_PAGES),
  referrer: z.string().max(1024).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    if (isBotUserAgent(req.headers.get("user-agent"))) return NO_CONTENT();

    const ip = getClientIp(req.headers);
    if (!rateLimit(`pv:${ip}`, IP_RATE).ok) return NO_CONTENT();

    const json = await req.json().catch(() => null);
    const parsed = beaconSchema.safeParse(json);
    if (!parsed.success) return NO_CONTENT();
    const { orgSlug, page, referrer } = parsed.data;

    if (!rateLimit(`pv:${ip}:${orgSlug}:${page}`, PAGE_RATE).ok) return NO_CONTENT();

    await connectDB();
    const ws = await resolveWorkspaceIdBySlug(orgSlug);
    if (!ws) return NO_CONTENT();

    const ua = req.headers.get("user-agent") ?? "";
    const now = new Date();
    await recordPageview({
      workspaceId: ws._id,
      page,
      visitorHash: visitorHash(ip, ua, now),
      source: classifySource(referrer ?? null, null, new URL(req.url).host),
      day: localDayStart(resolveWorkspaceTimezone(ws), now),
    });
  } catch (err) {
    // Tracking must never break the public page or 500 into a retry loop.
    console.error("[pageview] beacon failed (non-fatal):", err);
  }
  return NO_CONTENT();
}
