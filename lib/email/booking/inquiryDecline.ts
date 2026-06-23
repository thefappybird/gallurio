import "server-only";
import { sendEmail } from "../send";
import { renderBilingualEmail, bilingualSubject } from "../layout";
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

    const { html, text } = renderBilingualEmail({
      brand: params.brand,
      preheader: EMAIL_COPY.inquiryDecline.en.body1(params.businessName),
      secondaryLocale: locale,
      build: (loc) => {
        const copy = EMAIL_COPY.inquiryDecline[loc];
        return {
          title: copy.subject(params.businessName),
          blocks: [
            { type: "p", text: copy.greeting(params.clientName) },
            { type: "p", text: copy.body1(params.businessName) },
            { type: "p", text: copy.body2 },
          ],
        };
      },
    });

    const subject = bilingualSubject(
      EMAIL_COPY.inquiryDecline.en.subject(params.businessName),
      EMAIL_COPY.inquiryDecline[locale].subject(params.businessName),
      locale,
    );

    await sendEmail({
      to: params.clientEmail,
      replyTo: params.replyTo ?? undefined,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] sendInquiryDeclineClient failed:", err);
  }
}
