import "server-only";
import { sendEmail } from "@/lib/email/send";

/**
 * Sends a password reset / set-password link to `email`. The link points at the
 * first-party reset-password page (matching forgotPasswordAction's URL shape).
 * Used by both the forgot-password flow and the in-settings "set a password" flow.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gallurio.app";
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Gallurio";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: email,
    subject: `Set your ${appName} password`,
    html: `<p>Click the link below to set your password. It expires soon.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    text: `Set your password: ${resetUrl}\n\nThis link expires soon.`,
  });
}
