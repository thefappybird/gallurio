import "server-only";
import { sendEmail, type SendEmailResult } from "./send";
import { renderBrandedEmail } from "./layout";
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
    const copy = EMAIL_COPY.inquiryConfirmation[locale];

    const { html, text } = renderBrandedEmail({
      brand,
      locale,
      preheader: copy.body1(brand.name),
      title: copy.subject(brand.name),
      blocks: [
        { type: "p", text: copy.greeting(data.clientName) },
        { type: "p", text: copy.body1(brand.name) },
        { type: "p", text: copy.body2(brand.name) },
        { type: "p", text: copy.body3(brand.name) },
      ],
    });

    return await sendEmail({
      to: data.clientEmail,
      replyTo: data.ownerEmail ?? undefined,
      subject: copy.subject(brand.name),
      html,
      text,
    });
  } catch (err) {
    console.error("[email] sendInquiryClientConfirmation failed:", err);
    return { ok: false, error: "render_failed" };
  }
}
