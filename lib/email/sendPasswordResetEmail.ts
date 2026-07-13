import "server-only";
import { renderBrandedEmail } from "@/lib/email/layout";
import { gallurioBrand } from "@/lib/email/brand";
import { EMAIL_COPY } from "@/lib/email/messages";
import { sendEmail, logEmailFailure, type SendEmailResult } from "@/lib/email/send";

type Locale = "en" | "fil" | "ms" | "id";

/**
 * Sends a password reset / set-password link to `email` using the shared
 * branded template (platform-branded, Gallurio). Accepts an optional `locale`
 * (default "en") so the email copy matches the user's interface language.
 *
 * Used by both the forgot-password flow and the in-settings "set a password"
 * flow. Best-effort — never throws.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  locale: Locale = "en",
): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gallurio.app";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const copy = EMAIL_COPY.passwordReset[locale];

  const { html, text } = renderBrandedEmail({
    brand: gallurioBrand(),
    locale,
    preheader: copy.intro,
    title: copy.subject,
    blocks: [{ type: "p", text: copy.intro }],
    cta: { label: copy.cta, url: resetUrl },
    supportLine: copy.expiry,
  });

  const result = await sendEmail({
    to: email,
    subject: copy.subject,
    html,
    text,
  });
  if (!result.ok) logEmailFailure("password_reset", email, result);
  return result;
}
