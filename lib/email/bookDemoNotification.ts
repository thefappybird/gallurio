import "server-only";
import { sendEmail, type SendEmailResult } from "./send";
import { renderBrandedEmail } from "./layout";
import { gallurioBrand, SUPPORT_EMAIL } from "./brand";

export type BookDemoNotificationData = {
  name: string;
  email: string;
  businessName: string;
  message: string;
};

export async function sendBookDemoNotification(
  data: BookDemoNotificationData
): Promise<SendEmailResult> {
  const subject = `New demo request from ${data.name} (${data.businessName})`;

  const { html, text, attachments } = renderBrandedEmail({
    brand: gallurioBrand(),
    locale: "en",
    preheader: `${data.name} from ${data.businessName} requested a Gallurio demo.`,
    title: `New demo request from ${data.name}`,
    subtitle: data.businessName,
    blocks: [
      {
        type: "rows",
        rows: [
          { label: "Name", value: data.name },
          { label: "Email", value: data.email },
          { label: "Business/studio", value: data.businessName },
        ],
      },
      { type: "spacer" },
      { type: "heading", text: "What they'd like to see" },
      { type: "p", text: data.message },
    ],
  });

  return sendEmail({
    to: SUPPORT_EMAIL,
    replyTo: data.email,
    subject,
    text,
    html,
    attachments,
  });
}
