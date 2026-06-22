import "server-only";
import { sendEmail } from "../send";
import { renderBrandedEmail } from "../layout";
import { gallurioBrand, type Brand } from "../brand";
import { EMAIL_COPY, emailLocale } from "../messages";

export type BookingConfirmedClientParams = {
  brand: Brand;
  locale: string | null | undefined;
  clientName: string;
  clientEmail: string;
  businessName: string;
  eventTitle: string;
  sessions: Array<{ startDate: string; startTime: string; endTime: string }>;
  replyTo: string | null | undefined;
};

export type BookingConfirmedOwnerParams = {
  locale: string;
  ownerEmail: string;
  clientName: string;
  eventTitle: string;
  bookingId: string;
};

function bookingDetailUrl(bookingId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/bookings?detail=${bookingId}`;
}

function formatSessions(
  sessions: BookingConfirmedClientParams["sessions"]
): string {
  if (!sessions.length) return "";
  return sessions.map((s) => `${s.startDate} ${s.startTime}–${s.endTime}`).join(", ");
}

/**
 * Send a PARTNER-branded booking confirmation to the client.
 * Best-effort: never throws, never blocks the caller.
 * Skips silently when clientEmail is falsy.
 */
export async function sendBookingConfirmedClient(
  params: BookingConfirmedClientParams
): Promise<void> {
  if (!params.clientEmail) return;

  try {
    const locale = emailLocale(params.locale ?? null);
    const copy = EMAIL_COPY.bookingConfirmedClient[locale];
    const sessionsText = formatSessions(params.sessions);

    const blocks: Parameters<typeof renderBrandedEmail>[0]["blocks"] = [
      { type: "p", text: copy.greeting(params.clientName) },
      { type: "p", text: copy.body1(params.businessName) },
      { type: "p", text: copy.body2(params.eventTitle) },
      ...(sessionsText
        ? [{ type: "p" as const, text: copy.sessions(sessionsText) }]
        : []),
      { type: "p", text: copy.body3(params.businessName) },
    ];

    const { html, text } = renderBrandedEmail({
      brand: params.brand,
      locale,
      preheader: copy.body1(params.businessName),
      title: copy.subject(params.businessName),
      blocks,
    });

    await sendEmail({
      to: params.clientEmail,
      replyTo: params.replyTo ?? undefined,
      subject: copy.subject(params.businessName),
      html,
      text,
    });
  } catch (err) {
    console.error("[email] sendBookingConfirmedClient failed:", err);
  }
}

/**
 * Send a PLATFORM-branded booking confirmation to the workspace owner.
 * Best-effort: never throws, never blocks the caller.
 * CTA deep-links into /bookings?detail={bookingId} when NEXT_PUBLIC_APP_URL is set.
 */
export async function sendBookingConfirmedOwner(
  params: BookingConfirmedOwnerParams
): Promise<void> {
  try {
    const link = bookingDetailUrl(params.bookingId);

    const subject = `Booking confirmed: ${params.clientName} — ${params.eventTitle}`;

    const { html, text } = renderBrandedEmail({
      brand: gallurioBrand(),
      locale: "en",
      preheader: `${params.clientName}'s booking has been confirmed.`,
      title: `Booking confirmed`,
      subtitle: params.clientName,
      blocks: [
        { type: "p", text: `The booking for ${params.clientName} (${params.eventTitle}) has been confirmed.` },
        ...(link
          ? []
          : [{ type: "p" as const, text: "Open your booking dashboard to view the details." }]),
      ],
      ...(link ? { cta: { label: "View booking", url: link } } : {}),
    });

    await sendEmail({
      to: params.ownerEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] sendBookingConfirmedOwner failed:", err);
  }
}
