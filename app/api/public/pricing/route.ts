import "server-only";
import { NextResponse } from "next/server";
import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { staticFallback } from "@/lib/lemonsqueezy/pricing";
import { tierForCountry } from "@/lib/pricing/pricingTier";
import { getClientIp } from "@/lib/server/getClientIp";
import { rateLimit } from "@/lib/server/rateLimit";

// Public, unauthenticated read — Node runtime (headers()/Mongo reads live
// beneath getDisplayPricing). Lets app/[locale]/(marketing)/page.tsx become a
// static shell: the per-visitor price island fetches this client-side instead
// of the page forcing per-request rendering via headers().
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  // Country-dependent — must never be cached by a shared cache/CDN, only the
  // requesting browser. getProPricing (beneath getDisplayPricing) already
  // holds its own 1h server-side cache per tier.
  "Cache-Control": "private, max-age=300",
  Vary: "CF-IPCountry",
};

// No edge WAF on Hetzner (see docs/modules/hosting-ops.md, "Endpoint
// hardening"): a per-IP cap on this cheap-but-public read keeps a hammering
// client from repeatedly forcing a live pricing resolution.
const IP_RATE = { limit: 30, windowMs: 60_000 };

function betaEnabled(): boolean {
  return process.env.BETA_TESTER_ENABLED === "true";
}

// Country-dependent, so unlike the success path this must never be cached —
// a throttled/erroring US/EU/JP visitor pinning $5 (base tier) for 5 minutes
// while checkout charges the $15 global-tier price would be a real user-facing
// mismatch, not just a stale display number.
function fallbackResponse(country: string | null): Response {
  return NextResponse.json(
    { pricing: staticFallback(tierForCountry(country)), betaEnabled: betaEnabled() },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request): Promise<Response> {
  const ip = getClientIp(req.headers);
  const limit = rateLimit(`pricing:${ip}`, IP_RATE);
  if (!limit.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  try {
    const pricing = await getDisplayPricing();
    return NextResponse.json(
      { pricing, betaEnabled: betaEnabled() },
      { status: 200, headers: CACHE_HEADERS },
    );
  } catch (err) {
    // Never break the price island the marketing page renders — degrade to
    // the visitor's own tier's static catalog instead of a 500.
    console.error("[pricing] getDisplayPricing failed, falling back to static catalog:", err instanceof Error ? err.message : err);
    return fallbackResponse(req.headers.get("cf-ipcountry"));
  }
}
