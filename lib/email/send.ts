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
  attachments?: EmailAttachment[];
};

export type EmailAttachment = {
  filename: string;
  contentId?: string;
  content?: string;
  path?: string;
};

function resendAttachments(attachments: EmailAttachment[] | undefined) {
  return attachments?.map(({ contentId, ...attachment }) => ({
    ...attachment,
    ...(contentId ? { content_id: contentId } : {}),
  }));
}

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
    // Env validation requires RESEND_API_KEY in production (fails at startup),
    // so reaching here in production means a runtime misconfiguration — treat
    // it as a real failure, never a silent success, so callers can react.
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[email] RESEND_API_KEY is not set in production — failed to send "${input.subject}" to ${recipients.length} recipient(s).`
      );
      return { ok: false, error: "no_transport" };
    }

    // Non-prod (dev/test) — log and succeed so those flows aren't blocked.
    // Only print the full body (which contains client PII) in local dev. In a
    // prod-like env without a key (e.g. a misconfigured preview deploy) log just
    // the envelope so PII doesn't leak into shared function logs.
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[email:dev] (no RESEND_API_KEY) would send to ${recipients.join(", ")} — ` +
          `subject: ${input.subject}\n${input.text}`
      );
    } else {
      console.warn(
        `[email] RESEND_API_KEY is not set — skipped sending "${input.subject}" to ${recipients.length} recipient(s).`
      );
    }
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
        ...(input.attachments?.length ? { attachments: resendAttachments(input.attachments) } : {}),
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

// Structured, redacted failure log for critical-email sender wrappers (email
// verification, password reset, team invite, lifecycle reminders). `emailType`
// is a short semantic label (e.g. "password_reset"), never the recipient
// address or message body — only the count/type of recipients and the
// SendEmailResult error code are logged.
export function logEmailFailure(
  emailType: string,
  to: string | string[],
  result: SendEmailResult
): void {
  if (result.ok) return;
  const count = Array.isArray(to) ? to.length : 1;
  console.error(
    `[email] ${emailType} failed to send to ${count} recipient(s): ${result.error}`
  );
}
