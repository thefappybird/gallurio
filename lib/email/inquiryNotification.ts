import "server-only";
import { sendEmail, type SendEmailResult } from "./send";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inboxUrl(inquiryId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return null;
  const redirectTarget = encodeURIComponent(`/inquiries/${inquiryId}`);
  return `${base}/sign-in?redirect_url=${redirectTarget}`;
}

function formatSessions(sessions: InquiryNotificationData["sessions"]): string {
  return sessions.map((s) => `${s.startDate} - ${s.startTime} to ${s.endTime}`).join("\n");
}

function formatLocation(location: InquiryLocation): string {
  return location.address || location.label || "—";
}

export async function sendInquiryNotification(
  data: InquiryNotificationData
) : Promise<SendEmailResult> {
  const link = inboxUrl(data.inquiryId);
  const phone = data.clientPhone || "—";
  const location = formatLocation(data.location);
  const sessionsText = formatSessions(data.sessions) || "—";

  const subject = `New inquiry from ${data.clientName} - ${data.workspaceName}`;

  const text = [
    `You have a new booking inquiry on ${data.workspaceName}.`,
    "",
    `Name: ${data.clientName}`,
    `Email: ${data.clientEmail}`,
    `Phone: ${phone}`,
    `Preferred contact: ${data.preferredContact}`,
    "",
    `Event title: ${data.eventTitle}`,
    `Event type: ${data.eventType}`,
    `Location: ${location}`,
    "",
    "Requested dates:",
    sessionsText,
    "",
    "Message:",
    data.description,
    "",
    link ? `View Inquiry: ${link}` : "Open your Gallurio inquiries inbox to review this lead.",
  ].join("\n");

  const rows: Array<[string, string]> = [
    ["Name", data.clientName],
    ["Email", data.clientEmail],
    ["Phone", phone],
    ["Preferred contact", data.preferredContact],
    ["Event title", data.eventTitle],
    ["Event type", data.eventType],
    ["Location", location],
    ["Requested dates", sessionsText],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap;">${escapeHtml(
          label
        )}</td><td style="padding:6px 0;white-space:pre-line;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;">
      <h2 style="margin:0 0 4px;font-size:18px;">New booking inquiry</h2>
      <p style="margin:0 0 16px;color:#555;">on ${escapeHtml(data.workspaceName)}</p>
      <table style="border-collapse:collapse;font-size:14px;width:100%;">${rowsHtml}</table>
      <div style="margin-top:16px;">
        <div style="color:#666;font-size:14px;margin-bottom:4px;">Message</div>
        <div style="white-space:pre-line;font-size:14px;">${escapeHtml(data.description)}</div>
      </div>
      ${
        link
          ? `<p style="margin-top:24px;"><a href="${escapeHtml(
              link
            )}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;text-decoration:none;font-size:14px;">View Inquiry</a></p>`
          : `<p style="margin-top:24px;color:#666;font-size:14px;">Open your Gallurio inquiries inbox to review this lead.</p>`
      }
    </div>
  `;

  return sendEmail({
    to: data.recipientEmail,
    replyTo: data.clientEmail,
    subject,
    text,
    html,
  });
}
