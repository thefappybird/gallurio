import "server-only";
import { NextResponse } from "next/server";
import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { staticFallback } from "@/lib/lemonsqueezy/pricing";
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

function fallbackResponse(): Response {
  return NextResponse.json(
    { pricing: staticFallback("base"), betaEnabled: betaEnabled() },
    { status: 200, headers: CACHE_HEADERS },
  );
}

export async function GET(req: Request): Promise<Response> {
  const ip = getClientIp(req.headers);
  if (!rateLimit(`pricing:${ip}`, IP_RATE).ok) {
    return fallbackResponse();
  }

  try {
    const pricing = await getDisplayPricing();
    return NextResponse.json(
      { pricing, betaEnabled: betaEnabled() },
      { status: 200, headers: CACHE_HEADERS },
    );
  } catch (err) {
    // Never break the price island the marketing page renders — degrade to
    // the static base-tier catalog instead of a 500.
    console.error("[pricing] getDisplayPricing failed, falling back to static catalog:", err instanceof Error ? err.message : err);
    return fallbackResponse();
  }
}
