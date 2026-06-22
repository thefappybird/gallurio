import "server-only";
import { sendEmail, type SendEmailResult } from "./send";
import { renderBrandedEmail } from "./layout";
import { gallurioBrand } from "./brand";
import { buildInquiryAuthPath } from "@/lib/inquiries/links";

type InquiryLocation = {
  label?: string | null;
  address?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type InquiryNotificationData = {
  workspaceName: string;
  recipientEmail: string;
  inquiryId: string;
  ownerEmail: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  preferredContact: string;
  eventTitle: string;
  eventType: string;
  location: InquiryLocation;
  description: string;
  sessions: Array<{ startDate: string; startTime: string; endTime: string }>;
};

function inboxUrl(inquiryId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return null;
  return buildInquiryAuthPath(base, inquiryId);
}

function formatSessions(sessions: InquiryNotificationData["sessions"]): string {
  if (!sessions.length) return "—";
  return sessions.map((s) => `${s.startDate} ${s.startTime}–${s.endTime}`).join(", ");
}

function formatLocation(location: InquiryLocation): string {
  return location.address || location.label || "—";
}

export async function sendInquiryNotification(
  data: InquiryNotificationData
): Promise<SendEmailResult> {
  const link = inboxUrl(data.inquiryId);
  const phone = data.clientPhone || "—";
  const location = formatLocation(data.location);
  const sessionsText = formatSessions(data.sessions);

  const subject = `New inquiry from ${data.clientName} - ${data.workspaceName}`;

  const { html, text } = renderBrandedEmail({
    brand: gallurioBrand(),
    locale: "en",
    preheader: `${data.clientName} submitted a booking inquiry on ${data.workspaceName}.`,
    title: `New inquiry from ${data.clientName}`,
    subtitle: data.workspaceName,
    blocks: [
      {
        type: "rows",
        rows: [
          { label: "Name", value: data.clientName },
          { label: "Email", value: data.clientEmail },
          { label: "Phone", value: phone },
          { label: "Preferred contact", value: data.preferredContact },
          { label: "Event title", value: data.eventTitle },
          { label: "Event type", value: data.eventType },
          { label: "Location", value: location },
          { label: "Requested dates", value: sessionsText },
        ],
      },
      { type: "spacer" },
      { type: "heading", text: "Message" },
      { type: "p", text: data.description },
      ...(link
        ? []
        : [{ type: "p" as const, text: "Open your lead inbox to review this inquiry." }]),
    ],
    ...(link ? { cta: { label: "Review & approve", url: link } } : {}),
  });

  return sendEmail({
    to: data.recipientEmail,
    replyTo: data.clientEmail,
    subject,
    text,
    html,
  });
}
