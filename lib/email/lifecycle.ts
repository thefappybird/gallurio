import "server-only";
import { renderBrandedEmail } from "./layout";
import { gallurioBrand } from "./brand";
import { EMAIL_COPY, lifecycleEmailLocale } from "./messages";
import { sendEmail, logEmailFailure, type SendEmailResult } from "./send";

export type LifecycleEmailStage = "preExpiry" | "expired" | "remind1" | "remind2";

const COPY_KEY = {
  preExpiry: "lifecyclePreExpiry",
  expired: "lifecycleExpired",
  remind1: "lifecycleRemind1",
  remind2: "lifecycleRemind2",
} as const satisfies Record<LifecycleEmailStage, keyof typeof EMAIL_COPY>;

/**
 * Sends one lapse-lifecycle email (pre-expiry warning, expired, remind-1,
 * remind-2). Platform-branded (Gallurio), localized by the workspace country
 * via lifecycleEmailLocale() - same convention as sendPasswordResetEmail,
 * plus Arabic for Gulf countries (lifecycle-email-only; dashboard/portfolio
 * RTL is still deferred). CTA always links to the absolute /subscribe page.
 * Best-effort - never throws (see lib/email/send.ts).
 */
export async function sendLifecycleEmail(
  stage: LifecycleEmailStage,
  to: string,
  country: string | null | undefined,
): Promise<SendEmailResult> {
  const locale = lifecycleEmailLocale(country);
  const copy = EMAIL_COPY[COPY_KEY[stage]][locale];

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://gallurio.app").replace(/\/$/, "");
  const subscribeUrl = `${appUrl}/subscribe`;

  const { html, text } = renderBrandedEmail({
    brand: gallurioBrand(),
    locale,
    preheader: copy.body,
    title: copy.heading,
    blocks: [{ type: "p", text: copy.body }],
    cta: { label: copy.cta, url: subscribeUrl },
  });

  const result = await sendEmail({
    to,
    subject: copy.subject,
    html,
    text,
  });
  if (!result.ok) logEmailFailure(`lifecycle_${stage}`, to, result);
  return result;
}
