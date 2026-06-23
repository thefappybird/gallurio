import "server-only";
import { sendEmail, type SendEmailResult } from "./send";
import { renderBilingualEmail, bilingualSubject } from "./layout";
import { resolveWorkspaceBrand, type Brand } from "./brand";
import { EMAIL_COPY, emailLocale } from "./messages";

export type InquiryClientConfirmationData = {
  workspaceName: string;
  clientEmail: string;
  clientName: string;
  ownerEmail: string | null;
  brand?: Brand;
  country?: string | null;
};

export async function sendInquiryClientConfirmation(
  data: InquiryClientConfirmationData
): Promise<SendEmailResult> {
  try {
    const locale = emailLocale(data.country ?? null);
    const brand = data.brand ?? resolveWorkspaceBrand({ name: data.workspaceName });

    const { html, text } = renderBilingualEmail({
      brand,
      preheader: EMAIL_COPY.inquiryConfirmation.en.body1(brand.name),
      secondaryLocale: locale,
      build: (loc) => {
        const copy = EMAIL_COPY.inquiryConfirmation[loc];
        return {
          title: copy.subject(brand.name),
          blocks: [
            { type: "p", text: copy.greeting(data.clientName) },
            { type: "p", text: copy.body1(brand.name) },
            { type: "p", text: copy.body2(brand.name) },
            { type: "p", text: copy.body3(brand.name) },
          ],
        };
      },
    });

    const subject = bilingualSubject(
      EMAIL_COPY.inquiryConfirmation.en.subject(brand.name),
      EMAIL_COPY.inquiryConfirmation[locale].subject(brand.name),
      locale,
    );

    return await sendEmail({
      to: data.clientEmail,
      replyTo: data.ownerEmail ?? undefined,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] sendInquiryClientConfirmation failed:", err);
    return { ok: false, error: "render_failed" };
  }
}
