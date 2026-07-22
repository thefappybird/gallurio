import "server-only";
import { sendEmail, type SendEmailResult } from "./send";
import { renderBilingualEmail } from "./layout";
import { gallurioBrand } from "./brand";
import { EMAIL_COPY, emailLocale } from "./messages";

export type BookDemoConfirmationData = {
  email: string;
  name: string;
  country?: string | null;
};

export async function sendBookDemoConfirmation(
  data: BookDemoConfirmationData
): Promise<SendEmailResult> {
  try {
    const locale = emailLocale(data.country ?? null);
    const brand = gallurioBrand();

    const { html, text, attachments } = renderBilingualEmail({
      brand,
      preheader: EMAIL_COPY.demoBookingConfirmation.en.body1(brand.name),
      secondaryLocale: locale,
      build: (loc) => {
        const copy = EMAIL_COPY.demoBookingConfirmation[loc];
        return {
          title: copy.subject(brand.name),
          blocks: [
            { type: "p", text: copy.greeting(data.name) },
            { type: "p", text: copy.body1(brand.name) },
            { type: "p", text: copy.body2() },
            { type: "p", text: copy.body3() },
          ],
        };
      },
    });

    const subject = EMAIL_COPY.demoBookingConfirmation.en.subject(brand.name);

    return await sendEmail({
      to: data.email,
      subject,
      html,
      text,
      attachments,
    });
  } catch (err) {
    console.error("[email] sendBookDemoConfirmation failed:", err);
    return { ok: false, error: "render_failed" };
  }
}
