import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, Client, Inquiry, Booking } from "@/lib/db/models";
import {
  inquirySessionsToBookingSessions,
  type InquirySubmissionInput,
} from "@/lib/validators/inquiry";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import { sendInquiryNotification } from "@/lib/email/inquiryNotification";

export type SubmitInquiryResult =
  | { ok: true; inquiryId: string; draftBookingId: string; clientId: string }
  | { ok: false; error: "workspace_not_found" | "submission_failed" };

type SubmitInquiryInput = {
  workspaceSlug: string;
  payload: InquirySubmissionInput;
};

function normalizeOptional(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The core product mechanic: a public inquiry submission becomes a near-final
 * booking. In one transaction we match-or-create the Client (by email, scoped to
 * the workspace), write the Inquiry, and create a **draft** Booking linked back
 * via `createdFromInquiryId`. The owner later approves the draft in the lead
 * inbox (Phase 7), which promotes it onto the calendar.
 *
 * Draft bookings are deliberately NOT recorded against client financial metrics
 * (no `recordBookingForClient` here) — an unapproved draft must not inflate a
 * client's bookings count or spend. That bookkeeping happens on approval.
 *
 * All four writes share a Mongoose session/transaction: any failure rolls back
 * every write, so a partial submission never leaves orphan records.
 */
export async function submitInquiry(
  input: SubmitInquiryInput
): Promise<SubmitInquiryResult> {
  const { workspaceSlug, payload } = input;

  await connectDB();

  const slug = workspaceSlug.trim().toLowerCase();
  if (!slug) return { ok: false, error: "workspace_not_found" };

  // Resolve the workspace from the slug ONLY — never trust a client-supplied id.
  // Published portfolios only: an unpublished page cannot accept inquiries.
  const workspace = await Workspace.findOne({
    slug,
    "publicPage.publishedAt": { $ne: null },
  })
    .select({
      _id: 1,
      name: 1,
      currency: 1,
      timezone: 1,
      "contact.email": 1,
      "publicPage.inquiryRecipientEmail": 1,
    })
    .lean();

  if (!workspace) return { ok: false, error: "workspace_not_found" };

  const workspaceId = workspace._id;
  const timeZone = workspace.timezone || FALLBACK_TZ;
  const currency = workspace.currency || "PHP";

  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();
  const phone = normalizeOptional(payload.phone);
  const location = normalizeOptional(payload.location);
  const guestCount =
    typeof payload.guestCount === "number" ? payload.guestCount : null;
  const description = payload.description.trim();

  // Convert the wall-clock inquiry sessions into UTC instants for the booking.
  const bookingSessions = inquirySessionsToBookingSessions(payload.sessions, timeZone);
  const sessionStarts = bookingSessions.map((s) => s.startAt.getTime());
  const sessionEnds = bookingSessions.map((s) => s.endAt.getTime());
  const firstSessionStart = new Date(Math.min(...sessionStarts));
  const lastSessionEnd = new Date(Math.max(...sessionEnds));

  const session = await mongoose.startSession();
  let inquiryId: mongoose.Types.ObjectId | null = null;
  let draftBookingId: mongoose.Types.ObjectId | null = null;
  let clientId: mongoose.Types.ObjectId | null = null;

  try {
    await session.withTransaction(async () => {
      // 1. Match-or-create the client by { workspaceId, email }.
      const existing = await Client.findOne(
        { workspaceId, email },
        null,
        { session }
      );

      let resolvedClientId: mongoose.Types.ObjectId;
      let resolvedClientName: string;

      if (existing) {
        resolvedClientId = existing._id;
        resolvedClientName = existing.name;
        // Backfill a phone number only if we don't already have one.
        if (phone && !existing.phone) {
          await Client.updateOne(
            { _id: existing._id, workspaceId },
            { $set: { phone } },
            { session }
          );
        }
      } else {
        const [created] = await Client.create(
          [{ workspaceId, name, email, phone, source: "form" }],
          { session }
        );
        resolvedClientId = created._id;
        resolvedClientName = created.name;
      }

      // 2. Create the inquiry (status "new").
      const [inquiry] = await Inquiry.create(
        [
          {
            workspaceId,
            name,
            email,
            phone,
            preferredContact: payload.preferredContact,
            message: description,
            sessions: payload.sessions,
            eventDate: firstSessionStart,
            eventType: payload.eventType,
            guestCount,
            location,
            source: {
              utm_source: normalizeOptional(payload.utm_source),
              utm_medium: normalizeOptional(payload.utm_medium),
              utm_campaign: normalizeOptional(payload.utm_campaign),
              referrer: normalizeOptional(payload.referrer),
            },
            status: "new",
            clientId: resolvedClientId,
          },
        ],
        { session }
      );

      // 3. Create the draft booking, linked back to the inquiry.
      const [booking] = await Booking.create(
        [
          {
            workspaceId,
            clientId: resolvedClientId,
            clientName: resolvedClientName,
            title: `${resolvedClientName} — inquiry`,
            eventType: payload.eventType,
            status: "draft",
            sessions: bookingSessions,
            firstSessionStart,
            lastSessionEnd,
            location: { address: location ?? "" },
            amount: { total: 0, deposit: 0, currency },
            notes: description,
            createdFromInquiryId: inquiry._id,
          },
        ],
        { session }
      );

      // 4. Link the inquiry to its draft booking.
      await Inquiry.updateOne(
        { _id: inquiry._id, workspaceId },
        { $set: { draftBookingId: booking._id } },
        { session }
      );

      inquiryId = inquiry._id;
      draftBookingId = booking._id;
      clientId = resolvedClientId;
    });
  } catch (err) {
    console.error("[inquiry] submission transaction failed:", err);
    return { ok: false, error: "submission_failed" };
  } finally {
    await session.endSession();
  }

  if (!inquiryId || !draftBookingId || !clientId) {
    return { ok: false, error: "submission_failed" };
  }

  // 5. Best-effort owner notification — must NOT roll back the submission.
  const recipient =
    normalizeOptional(workspace.publicPage?.inquiryRecipientEmail) ??
    normalizeOptional(workspace.contact?.email);
  if (recipient) {
    try {
      await sendInquiryNotification({
        workspaceName: workspace.name,
        recipientEmail: recipient,
        inquiryId: String(inquiryId),
        clientName: name,
        clientEmail: email,
        clientPhone: phone,
        preferredContact: payload.preferredContact,
        eventType: payload.eventType,
        guestCount,
        location,
        description,
        sessions: payload.sessions,
      });
    } catch (err) {
      console.error("[inquiry] notification failed (non-fatal):", err);
    }
  }

  return {
    ok: true,
    inquiryId: String(inquiryId),
    draftBookingId: String(draftBookingId),
    clientId: String(clientId),
  };
}
