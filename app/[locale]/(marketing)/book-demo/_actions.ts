"use server";

import { headers } from "next/headers";
import { bookDemoSubmissionSchema } from "@/lib/validators/bookDemo";
import { sendBookDemoNotification } from "@/lib/email/bookDemoNotification";
import { sendBookDemoConfirmation } from "@/lib/email/bookDemoConfirmation";
import { rateLimit } from "@/lib/server/rateLimit";
import { getClientIp } from "@/lib/server/getClientIp";

// Matches app/api/inquiries/route.ts's public-form rate limit.
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60_000 };

export type SubmitBookDemoResult = { ok: true } | { ok: false; error: string };

export async function submitBookDemoAction(input: unknown): Promise<SubmitBookDemoResult> {
  const h = await headers();
  const ip = getClientIp(h);
  const limited = rateLimit(`book-demo:${ip}`, RATE_LIMIT);
  if (!limited.ok) return { ok: false, error: "rate_limited" };

  const parsed = bookDemoSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid_request" };
  }

  // Success = validation passed. Both emails are best-effort/non-fatal, same
  // pattern as lib/server/inquirySubmission.ts — a Resend failure must never
  // turn a valid submission into a user-facing error.
  try {
    await sendBookDemoNotification(parsed.data);
  } catch (err) {
    console.error("[book-demo] notification failed (non-fatal):", err);
  }
  try {
    await sendBookDemoConfirmation({ email: parsed.data.email, name: parsed.data.name });
  } catch (err) {
    console.error("[book-demo] confirmation failed (non-fatal):", err);
  }

  return { ok: true };
}
