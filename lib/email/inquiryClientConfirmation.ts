import "server-only";
import { sendEmail, type SendEmailResult } from "./send";

export type InquiryClientConfirmationData = {
  workspaceName: string;
  clientEmail: string;
  clientName: string;
  ownerEmail: string | null;
};

export async function sendInquiryClientConfirmation(
  data: InquiryClientConfirmationData
): Promise<SendEmailResult> {
  const subject = `We received your inquiry - ${data.workspaceName}`;
  const text = [
    `Hi ${data.clientName},`,
    "",
    `Thanks for reaching out to ${data.workspaceName}.`,
    "We received your inquiry and the owner will respond soon.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;">
      <p style="margin:0 0 12px;">Hi ${data.clientName},</p>
      <p style="margin:0 0 12px;">Thanks for reaching out to ${data.workspaceName}.</p>
      <p style="margin:0;">We received your inquiry and the owner will respond soon.</p>
    </div>
  `;

  return sendEmail({
    to: data.clientEmail,
    replyTo: data.ownerEmail ?? undefined,
    subject,
    text,
    html,
  });
}
