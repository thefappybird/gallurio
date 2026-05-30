import "server-only";

// Transactional email transport.
//
// Provider: Resend (https://resend.com) over its plain HTTPS API — no SDK so we
// add zero dependencies (simplicity principle). Set three env vars to go live:
//   RESEND_API_KEY   — your Resend API key (test or live).
//   EMAIL_FROM       — verified sender, e.g. "Gallurio <hello@yourdomain.com>".
//                      Defaults to Resend's shared sandbox sender for dev.
//   EMAIL_REPLY_TO   — optional global reply-to override.
//
// Dev / no-key fallback: when RESEND_API_KEY is unset the message is logged to
// the server console instead of sent, and the call reports `{ ok: true,
// skipped: true }`. This keeps every flow that sends mail (the inquiry notify in
// Phase 6) fully testable locally without any account setup.
//
// This function NEVER throws — callers treat email as best-effort and must not
// let a mail failure roll back a database write.

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null; skipped?: boolean }
  | { ok: false; error: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Gallurio <onboarding@resend.dev>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  const replyTo = input.replyTo || process.env.EMAIL_REPLY_TO || undefined;
  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  if (!apiKey) {
    // No transport configured — log and succeed so dev flows aren't blocked.
    console.info(
      `[email:dev] (no RESEND_API_KEY) would send to ${recipients.join(", ")} — ` +
        `subject: ${input.subject}\n${input.text}`
    );
    return { ok: true, id: null, skipped: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[email] Resend rejected the message (${res.status}): ${detail.slice(0, 500)}`
      );
      return { ok: false, error: `resend_${res.status}` };
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id ?? null };
  } catch (err) {
    console.error("[email] Failed to reach Resend:", err);
    return { ok: false, error: "transport_error" };
  }
}
