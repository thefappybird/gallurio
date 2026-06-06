import { NextResponse } from "next/server";
import { inquirySubmissionSchema } from "@/lib/validators/inquiry";
import { submitInquiry } from "@/lib/server/inquirySubmission";
import { rateLimit } from "@/lib/server/rateLimit";

// Public, unauthenticated endpoint — never Edge (transactions need Node).
export const runtime = "nodejs";

const RATE_LIMIT = { limit: 5, windowMs: 10 * 60_000 };

// Resolve the client IP for rate-limit keying. Prefer Vercel's tamper-resistant
// `x-vercel-forwarded-for` (set by the platform, not the client) so a spoofed
// `X-Forwarded-For` can't mint a fresh bucket per request. Fall back to the
// first XFF hop for non-Vercel/local runs. NOTE: this in-process limiter is
// best-effort spam control; real abuse protection belongs at the edge/WAF
// (see docs/RELEASE-CHECKLIST.md).
function getClientIp(req: Request): string {
  const trusted = req.headers.get("x-vercel-forwarded-for");
  if (trusted) return trusted.split(",")[0]?.trim() || "unknown";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  // Honeypot — a non-empty `company_name` means a bot filled a hidden field.
  // Reject before doing any work; return a generic 400.
  if (typeof json.company_name === "string" && json.company_name.trim() !== "") {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  // Per-IP rate limit — blunt the form against spam and double-submits.
  const ip = getClientIp(req);
  const limited = rateLimit(`inquiry:${ip}`, RATE_LIMIT);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(0, Math.ceil((limited.resetAt - Date.now()) / 1000))),
        },
      }
    );
  }

  const workspaceSlug = typeof json.workspaceSlug === "string" ? json.workspaceSlug : "";
  if (!workspaceSlug.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const parsed = inquirySubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "invalid_request" },
      { status: 400 }
    );
  }

  const result = await submitInquiry({ workspaceSlug, payload: parsed.data });

  if (!result.ok) {
    const status = result.error === "workspace_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json(
    { ok: true, inquiryId: result.inquiryId },
    { status: 200 }
  );
}
