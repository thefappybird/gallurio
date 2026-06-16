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
import { sendInquiryClientConfirmation } from "@/lib/email/inquiryClientConfirmation";
import { sendNotification } from "@/lib/notifications/send";

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

function normalizeLocation(payload: InquirySubmissionInput["location"]) {
  return {
    label: normalizeOptional(payload.label ?? null),
    address: normalizeOptional(payload.address ?? null),
    placeId: normalizeOptional(payload.placeId ?? null),
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
  };
}

export async function submitInquiry(
  input: SubmitInquiryInput
): Promise<SubmitInquiryResult> {
  const { workspaceSlug, payload } = input;

  await connectDB();

  const slug = workspaceSlug.trim().toLowerCase();
  if (!slug) return { ok: false, error: "workspace_not_found" };

  const workspace = await Workspace.findOne({
    slug,
    "publicPage.publishedAt": { $ne: null },
  })
    .select({
      _id: 1,
      name: 1,
      ownerUserId: 1,
      currency: 1,
      timezone: 1,
      "contact.email": 1,
      "publicPage.inquiryRecipientEmail": 1,
      "publicPage.formLocale": 1,
    })
    .lean();

  if (!workspace) return { ok: false, error: "workspace_not_found" };

  const workspaceId = workspace._id;
  const timeZone = workspace.timezone || FALLBACK_TZ;
  const currency = workspace.currency || "PHP";

  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();
  const phone = normalizeOptional(payload.phone);
  const eventTitle = payload.eventTitle.trim();
  const location = normalizeLocation(payload.location);
  const description = payload.description.trim();

  const bookingSessions = inquirySessionsToBookingSessions(payload.sessions, timeZone);
  if (bookingSessions.length === 0) {
    console.error("[inquiry] submission rejected: no sessions provided");
    return { ok: false, error: "submission_failed" };
  }

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
      const existing = await Client.findOne({ workspaceId, email }, null, { session });

      let resolvedClientId: mongoose.Types.ObjectId;
      let resolvedClientName: string;

      if (existing) {
        resolvedClientId = existing._id;
        resolvedClientName = existing.name;
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
            eventTitle,
            eventType: payload.eventType,
            location,
            source: {
              kind: "portfolio",
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

      const [booking] = await Booking.create(
        [
          {
            workspaceId,
            clientId: resolvedClientId,
            clientName: resolvedClientName,
            title: eventTitle,
            eventType: payload.eventType,
            status: "draft",
            sessions: bookingSessions,
            firstSessionStart,
            lastSessionEnd,
            location,
            amount: { total: 0, deposit: 0, currency },
            notes: description,
            createdFromInquiryId: inquiry._id,
          },
        ],
        { session }
      );

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

  const recipient =
    normalizeOptional(workspace.publicPage?.inquiryRecipientEmail) ??
    normalizeOptional(workspace.contact?.email);

  if (recipient) {
    try {
      await sendInquiryNotification({
        workspaceName: workspace.name,
        recipientEmail: recipient,
        inquiryId: String(inquiryId),
        ownerEmail: recipient,
        clientName: name,
        clientEmail: email,
        clientPhone: phone,
        preferredContact: payload.preferredContact,
        eventTitle,
        eventType: payload.eventType,
        location,
        description,
        sessions: payload.sessions,
      });
    } catch (err) {
      console.error("[inquiry] notification failed (non-fatal):", err);
    }
  }

  try {
    await sendInquiryClientConfirmation({
      workspaceName: workspace.name,
      clientEmail: email,
      clientName: name,
      ownerEmail: recipient,
    });
  } catch (err) {
    console.error("[inquiry] client confirmation failed (non-fatal):", err);
  }

  const ownerEmail = workspace.contact?.email ?? "";
  if (ownerEmail) {
    const notifLocale = workspace.publicPage?.formLocale || "en";
    await sendNotification({
      workspaceId: String(workspaceId),
      recipients: [{ workosUserId: workspace.ownerUserId, email: ownerEmail }],
      type: "inquiry.created",
      entityId: String(inquiryId),
      entityType: "inquiry",
      triggeredByWorkosUserId: "public",
      locale: notifLocale,
      vars: { clientName: name || "Unknown" },
    });
  }

  return {
    ok: true,
    inquiryId: String(inquiryId),
    draftBookingId: String(draftBookingId),
    clientId: String(clientId),
  };
}
