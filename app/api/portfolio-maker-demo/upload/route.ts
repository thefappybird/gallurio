import { NextResponse } from "next/server";
import { z } from "zod";
import { requestDirectUpload, DEMO_UPLOAD_SUBFOLDER } from "@/lib/storage/cloudflareImages";
import { rateLimit } from "@/lib/server/rateLimit";
import { getClientIp } from "@/lib/server/getClientIp";

export const runtime = "nodejs";

// Public, unauthenticated: lets an anonymous Portfolio Maker demo visitor try
// the upload flow without signing up. Two independent limiters guard this:
// 1. Per-IP flood control (below) — abuse control, generous.
// 2. Per-demo-session image cap (in POST) — the actual product limit.
const IP_RATE_LIMIT = { limit: 30, windowMs: 15 * 60_000 };

// Product cap: 10 images per demo session. Reuses the same sliding-window
// in-memory limiter as abuse control (see lib/server/rateLimit.ts) with a
// 24h window as a stand-in for "per session" — deliberate simplification,
// not a real session store. Same limitations apply: resets on cold start /
// per-instance only. Good enough for a demo feature with no persisted state.
const DEMO_IMAGE_CAP = { limit: 10, windowMs: 24 * 60 * 60_000 };

const bodySchema = z.object({
  // UUID-only, matching lib/validators/demoImport.ts. The id is written into
  // the asset's `workspaceId` metadata, so allowing an arbitrary string would
  // let a caller mint assets tagged with a real workspace's ObjectId.
  demoSessionId: z.string().uuid(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const ipLimited = rateLimit(`portfolio-maker-demo-upload:${ip}`, IP_RATE_LIMIT);
  if (!ipLimited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(0, Math.ceil((ipLimited.resetAt - Date.now()) / 1000))),
        },
      }
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { demoSessionId } = parsed.data;

  const imageCap = rateLimit(`portfolio-maker-demo-images:${demoSessionId}`, DEMO_IMAGE_CAP);
  if (!imageCap.ok) {
    return NextResponse.json({ error: "image_cap_reached" }, { status: 400 });
  }

  try {
    const { imageId, uploadURL } = await requestDirectUpload(demoSessionId, DEMO_UPLOAD_SUBFOLDER);
    return NextResponse.json({ imageId, uploadURL });
  } catch (err) {
    console.error("[portfolio-maker-demo/upload] requestDirectUpload failed", err);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
