import { NextResponse } from "next/server";
import { inquirySubmissionSchema } from "@/lib/validators/inquiry";
import { submitInquiry } from "@/lib/server/inquirySubmission";
import { rateLimit } from "@/lib/server/rateLimit";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import { getClientIp } from "@/lib/server/getClientIp";

// Public, unauthenticated endpoint — never Edge (transactions need Node).
export const runtime = "nodejs";

const RATE_LIMIT = { limit: 5, windowMs: 10 * 60_000 };

export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  // Honeypot — a non-empty or non-string `company_name` means a bot filled a
  // hidden field (or sent a truthy non-string value). Reject before any work.
  if (json.company_name != null && json.company_name !== "") {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  // Per-IP rate limit — blunt the form against spam and double-submits.
  const ip = getClientIp(req.headers);
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

  // Bot check -- networked, so it runs after the free local checks above.
  const turnstileToken = typeof json.turnstileToken === "string" ? json.turnstileToken : null;
  const verified = await verifyTurnstileToken(turnstileToken, ip);
  if (!verified) {
    return NextResponse.json({ ok: false, error: "verification_failed" }, { status: 400 });
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
