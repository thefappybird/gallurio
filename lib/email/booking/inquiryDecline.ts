import "server-only";
import { sendEmail } from "../send";
import { renderBrandedEmail } from "../layout";
import type { Brand } from "../brand";
import { EMAIL_COPY, emailLocale } from "../messages";

export type InquiryDeclineClientParams = {
  brand: Brand;
  locale: string | null | undefined;
  clientName: string;
  clientEmail: string;
  businessName: string;
  replyTo: string | null | undefined;
};

/**
 * Send a PARTNER-branded inquiry decline to the client.
 * Best-effort: never throws, never blocks the caller.
 * Skips silently when clientEmail is falsy.
 */
export async function sendInquiryDeclineClient(
  params: InquiryDeclineClientParams
): Promise<void> {
  if (!params.clientEmail) return;

  try {
    const locale = emailLocale(params.locale ?? null);
    const copy = EMAIL_COPY.inquiryDecline[locale];

    const { html, text } = renderBrandedEmail({
      brand: params.brand,
      locale,
      preheader: copy.body1(params.businessName),
      title: copy.subject(params.businessName),
      blocks: [
        { type: "p", text: copy.greeting(params.clientName) },
        { type: "p", text: copy.body1(params.businessName) },
        { type: "p", text: copy.body2 },
      ],
    });

    await sendEmail({
      to: params.clientEmail,
      replyTo: params.replyTo ?? undefined,
      subject: copy.subject(params.businessName),
      html,
      text,
    });
  } catch (err) {
    console.error("[email] sendInquiryDeclineClient failed:", err);
  }
}
