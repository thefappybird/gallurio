"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Inquiry, Booking, ActivityLog, Team, Client } from "@/lib/db/models";
import { recordBookingForClient } from "@/lib/db/clientTransactions";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";
import { inquirySessionsEditSchema, inquirySessionsToBookingSessions, type InquirySessionsEditInput } from "@/lib/validators/inquiry";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import { getShiftsOnDate } from "@/lib/bookings/shift-conflicts";
import { overlappingShifts, toMinutes } from "@/app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers";
import { computeInquiryConflicts, sessionConflictsWithBookings } from "@/lib/db/queries/inquiry-conflicts";
import { sendBookingConfirmedClient, sendBookingConfirmedOwner } from "@/lib/email/booking/bookingConfirmed";
import { resolveWorkspaceBrand } from "@/lib/email/brand";
import { emailLocale } from "@/lib/email/messages";
import { resolveTeamRecipients } from "@/lib/notifications/recipients";
import { sendNotification } from "@/lib/notifications/send";

// The status a draft is promoted to on approval. Approval skips the old
// "inquiry" pipeline state and lands directly on "booked". Drafts are the
// only state hidden from the calendar.
const PROMOTED_STATUS = "booked" as const;

export type InquiryActionResult =
  | { ok: true; bookingId?: string; idempotent?: boolean }
  | { error: string };

const draftEditsSchema = z
  .object({
    total: z.coerce.number().min(0).max(1_000_000_000).optional(),
    deposit: z.coerce.number().min(0).max(1_000_000_000).optional(),
    notes: z.string().max(5000).optional(),
    teamId: z.string().refine((v) => mongoose.isValidObjectId(v), { message: "invalid_team" }).nullable().optional(),
  })
  .refine((v) => v.deposit === undefined || v.total === undefined || v.deposit <= v.total, {
    message: "Deposit cannot exceed the total",
    path: ["deposit"],
  });

export type DraftEdits = z.infer<typeof draftEditsSchema>;

// Reusable phone validator — matches the phone rule in inquirySessionsEditSchema
// (min 7, max 30, or empty string).
const phoneSchema = z.string().trim().min(7).max(30).or(z.literal(""));

function revalidateInquiry(id: string) {
  revalidatePath("/inquiries");
  revalidatePath(`/inquiries/${id}`);
}

/**
 * Promote an inquiry's draft booking to a real booking and mark the inquiry
 * booked. Owner-only, idempotent (re-clicking an already-booked inquiry is a
 * no-op), and transactional — the booking promotion, client financial record,
 * and inquiry status flip all commit together or not at all.
 */
export async function approveInquiryBookingAction(
  inquiryId: string,
  draftEdits?: DraftEdits
): Promise<InquiryActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") {
    return { error: "owner_only" };
  }

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  const edits = draftEditsSchema.safeParse(draftEdits ?? {});
  if (!edits.success) {
    return { error: edits.error.errors[0]?.message ?? "invalid_input" };
  }

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId });
  if (!inquiry) return { error: "not_found" };

  // Idempotency: already approved -> return the existing booking, do nothing.
  if (isBookedInquiryStatus(inquiry.status) && inquiry.convertedBookingId) {
    return { ok: true, bookingId: inquiry.convertedBookingId.toString(), idempotent: true };
  }

  // Server-side conflict guard: recompute whether any of the inquiry's sessions
  // conflict with real (non-draft, non-cancelled) bookings in a single batched
  // query. computeInquiryConflicts already excludes draft and cancelled bookings
  // so the inquiry's own draft booking is excluded automatically.
  // Workspace timezone and workspaceId come from the server session only.
  const tz = ctx.workspace.timezone ?? FALLBACK_TZ;
  let conflictIds: Set<string>;
  try {
    conflictIds = await computeInquiryConflicts(
      workspaceId,
      [{ _id: String(inquiry._id), sessions: inquiry.sessions as { startDate: string; startTime: string; endTime: string }[] }],
      tz
    );
  } catch (err) {
    console.error('[inquiry] approve conflict check failed:', err);
    return { error: 'conflict_check_failed' };
  }
  if (conflictIds.has(String(inquiry._id))) return { error: 'conflict' };

  const booking = await Booking.findOne({ _id: inquiry.draftBookingId, workspaceId }).lean();
  if (!booking) return { error: "missing_draft" };

  const previousStatus = booking.status;
  // Merge owner edits over the draft's current amount.
  const newAmount = {
    total: edits.data.total ?? booking.amount?.total ?? 0,
    deposit: edits.data.deposit ?? booking.amount?.deposit ?? 0,
    currency: booking.amount?.currency ?? ctx.workspace.currency ?? "PHP",
  };
  const newNotes = edits.data.notes ?? booking.notes ?? "";

  // Did THIS call perform the promotion? A concurrent approval can win the
  // `status: "draft"` race (matchedCount === 0); only the winner fires the
  // post-commit emails/notification, so the loser must not double-send.
  let promotedThisCall = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Promote the draft. The `status: "draft"` guard makes the write a no-op
      // if a concurrent approval already promoted it.
      const promoted = await Booking.updateOne(
        { _id: booking._id, workspaceId, status: "draft" },
        {
          $set: {
            status: PROMOTED_STATUS,
            "amount.total": newAmount.total,
            "amount.deposit": newAmount.deposit,
            notes: newNotes,
          },
        },
        { session }
      );

      if (promoted.matchedCount === 0) return;
      promotedThisCall = true;

      await recordBookingForClient({
        workspaceId,
        clientId: booking.clientId,
        booking: {
          _id: booking._id,
          amount: newAmount,
          firstSessionStart: booking.firstSessionStart,
        },
        source: "manual",
        session,
      });

      await Inquiry.updateOne(
        { _id: inquiry._id, workspaceId },
        {
          $set: {
            status: "booked",
            convertedBookingId: booking._id,
            convertedClientId: inquiry.clientId,
          },
        },
        { session }
      );

      await ActivityLog.create(
        [
          {
            workspaceId,
            actorUserId: ctx.userId,
            entity: "booking",
            entityId: booking._id,
            action: "status_changed",
            meta: { from: previousStatus, to: PROMOTED_STATUS, via: "inquiry_approval" },
          },
        ],
        { session }
      );
    });
  } catch (err) {
    console.error("[inquiry] approve transaction failed:", err);
    return { error: "approve_failed" };
  } finally {
    await session.endSession();
  }

  // A concurrent approval already promoted this booking and owns its
  // side-effects — return the booked result without re-sending anything.
  if (!promotedThisCall) {
    revalidateInquiry(inquiryId);
    revalidatePath("/bookings");
    revalidatePath("/dashboard");
    return { ok: true, bookingId: booking._id.toString() };
  }

  // --- Post-commit side-effects (best-effort, never throw, never roll back) ---
  const locale = emailLocale(ctx.workspace.country ?? null);
  const ownerEmail = ctx.workspace.contact?.email || null;

  // Load the booking's client for the confirmation email.
  const client = await Client.findOne(
    { _id: booking.clientId, workspaceId },
    { email: 1, name: 1 },
  ).lean().catch(() => null);

  if (client?.email) {
    const brand = resolveWorkspaceBrand({
      name: ctx.workspace.name,
      publicPage: ctx.workspace.publicPage
        ? {
            header: { logoUrl: ctx.workspace.publicPage.header?.logoUrl },
            brandKit: { accentColor: ctx.workspace.publicPage.brandKit?.accentColor },
          }
        : undefined,
      contact: ownerEmail ? { email: ownerEmail } : undefined,
    });

    void sendBookingConfirmedClient({
      brand,
      locale: ctx.workspace.country ?? null,
      clientName: client.name,
      clientEmail: client.email,
      businessName: ctx.workspace.name,
      eventTitle: booking.title,
      sessions: inquiry.sessions as Array<{ startDate: string; startTime: string; endTime: string }>,
      replyTo: ownerEmail,
    }).catch(() => {});
  }

  if (ownerEmail) {
    void sendBookingConfirmedOwner({
      ownerEmail,
      clientName: booking.clientName,
      eventTitle: booking.title,
      bookingId: booking._id.toString(),
    }).catch(() => {});
  }

  // Team notification (or owner fallback).
  const notifEntityId = booking._id.toString();
  const clientName = booking.clientName;

  void (async () => {
    try {
      let recipients;
      if (booking.teamId) {
        recipients = await resolveTeamRecipients(workspaceId, booking.teamId);
      }
      if (!recipients || recipients.length === 0) {
        // No team or empty team — notify the owner. email:"" is intentional:
        // the owner's confirmation email is sent separately above, so this
        // recipient only drives the in-app/DB notification, not a second email.
        recipients = ownerEmail
          ? [{ workosUserId: ctx.workspace.ownerUserId, email: "" }]
          : [];
      }
      if (recipients.length > 0) {
        await sendNotification({
          workspaceId: String(workspaceId),
          recipients,
          type: "booking.team_assigned",
          entityId: notifEntityId,
          entityType: "booking",
          triggeredByWorkosUserId: ctx.userId,
          locale,
          vars: { clientName },
        });
      }
    } catch (err) {
      console.error("[inquiry] approve notification failed (non-fatal):", err);
    }
  })();

  revalidateInquiry(inquiryId);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
  return { ok: true, bookingId: booking._id.toString() };
}

/** Persist owner-only edits to the draft booking without approving it yet. */
export async function saveDraftBookingFieldsAction(
  inquiryId: string,
  draftEdits: DraftEdits
): Promise<InquiryActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  const edits = draftEditsSchema.safeParse(draftEdits);
  if (!edits.success) {
    return { error: edits.error.errors[0]?.message ?? "invalid_input" };
  }

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId }).lean();
  if (!inquiry?.draftBookingId) return { error: "missing_draft" };

  const set: Record<string, unknown> = {};
  if (edits.data.total !== undefined) set["amount.total"] = edits.data.total;
  if (edits.data.deposit !== undefined) set["amount.deposit"] = edits.data.deposit;
  if (edits.data.notes !== undefined) set.notes = edits.data.notes;
  if (edits.data.teamId !== undefined) {
    if (!edits.data.teamId) {
      set.teamId = null;
    } else {
      if (!mongoose.isValidObjectId(edits.data.teamId)) return { error: "invalid_team" };
      const team = await Team.findOne({ _id: edits.data.teamId, workspaceId }).lean();
      if (!team) return { error: "invalid_team" };
      set.teamId = team._id;
    }
  }

  if (Object.keys(set).length > 0) {
    await Booking.updateOne(
      { _id: inquiry.draftBookingId, workspaceId, status: "draft" },
      { $set: set }
    );
    await ActivityLog.create({
      workspaceId,
      actorUserId: ctx.userId,
      entity: "inquiry",
      entityId: inquiry._id,
      action: "updated",
      diff: edits.data,
    });
  }

  revalidateInquiry(inquiryId);
  return { ok: true };
}


/** Triage: archive an inquiry. Booked inquiries cannot be archived. */
export async function archiveInquiryAction(inquiryId: string): Promise<InquiryActionResult> {
  const ctx = await requireOrg();

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  await connectDB();

  const inquiry = await Inquiry.findOne({
    _id: inquiryId,
    workspaceId: ctx.workspace._id,
    status: { $nin: ["booked", "converted"] },
  }).lean();
  if (!inquiry) return { error: "not_found" };

  const res = await Inquiry.updateOne(
    { _id: inquiryId, workspaceId: ctx.workspace._id, status: { $nin: ["booked", "converted"] } },
    { $set: { status: "archived" } }
  );
  if (res.matchedCount === 0) return { error: "not_found" };

  await ActivityLog.create({
    workspaceId: ctx.workspace._id,
    actorUserId: ctx.userId,
    entity: "inquiry",
    entityId: inquiry._id,
    action: "status_changed",
    meta: { from: inquiry.status, to: "archived" },
  });

  revalidateInquiry(inquiryId);
  return { ok: true };
}

/** Edit the requested sessions and optional phone on a non-converted inquiry. */
export async function editInquirySessionsAction(
  inquiryId: string,
  input: InquirySessionsEditInput
): Promise<InquiryActionResult> {
  const ctx = await requireOrg();

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId });
  if (!inquiry) return { error: "not_found" };

  if (isBookedInquiryStatus(inquiry.status)) return { error: "locked" };

  const parsed = inquirySessionsEditSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  if (parsed.data.sessions.length !== inquiry.sessions.length) {
    return { error: "alter_only" };
  }

  const tz = ctx.workspace.timezone ?? FALLBACK_TZ;
  const excludeId = inquiry.draftBookingId ? String(inquiry.draftBookingId) : null;

  // Batch shift lookups: fetch shifts once per unique date instead of once per
  // session. For a 20-session inquiry that all share the same date this collapses
  // 20 queries into 1; for n distinct dates it runs n queries (one each).
  const uniqueDates = [...new Set(parsed.data.sessions.map((s) => s.startDate))];
  const shiftsByDate = new Map<string, Awaited<ReturnType<typeof getShiftsOnDate>>>();
  for (const date of uniqueDates) {
    shiftsByDate.set(date, await getShiftsOnDate(workspaceId, date, tz, { excludeId }));
  }

  for (const s of parsed.data.sessions) {
    const shifts = shiftsByDate.get(s.startDate)!;
    const aStart = toMinutes(s.startTime);
    const aEnd = toMinutes(s.endTime);
    if (aStart !== null && aEnd !== null && overlappingShifts(shifts, aStart, aEnd).length > 0) {
      return { error: "conflict" };
    }
  }

  const utcSessions = inquirySessionsToBookingSessions(parsed.data.sessions, tz);
  const firstSessionStart = utcSessions.reduce((a, b) => (a.startAt < b.startAt ? a : b)).startAt;
  const lastSessionEnd = utcSessions.reduce((a, b) => (a.endAt > b.endAt ? a : b)).endAt;

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const phoneUpdate =
        parsed.data.phone !== undefined
          ? { phone: parsed.data.phone || null }
          : {};

      await Inquiry.updateOne(
        { _id: inquiryId, workspaceId },
        {
          $set: {
            sessions: parsed.data.sessions,
            eventDate: new Date(parsed.data.sessions[0].startDate),
            ...phoneUpdate,
          },
        },
        { session: mongoSession }
      );

      if (inquiry.draftBookingId) {
        await Booking.updateOne(
          { _id: inquiry.draftBookingId, workspaceId },
          { $set: { sessions: utcSessions, firstSessionStart, lastSessionEnd } },
          { session: mongoSession }
        );
      }

      await ActivityLog.create(
        [
          {
            workspaceId,
            actorUserId: ctx.userId,
            entity: "inquiry",
            entityId: inquiry._id,
            action: "updated",
            diff: { sessions: parsed.data.sessions },
          },
        ],
        { session: mongoSession }
      );
    });
  } catch (err) {
    console.error("[inquiry] editSessions transaction failed:", err);
    return { error: "edit_sessions_failed" };
  } finally {
    await mongoSession.endSession();
  }

  revalidateInquiry(inquiryId);
  return { ok: true };
}

/** Update only the phone number on a non-converted inquiry. */
export async function updateInquiryPhoneAction(
  inquiryId: string,
  phone: string
): Promise<InquiryActionResult> {
  const ctx = await requireOrg();

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  const phoneParsed = phoneSchema.safeParse(phone);
  if (!phoneParsed.success) return { error: "invalid_input" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId });
  if (!inquiry) return { error: "not_found" };
  if (isBookedInquiryStatus(inquiry.status)) return { error: "locked" };

  const sanitized = phoneParsed.data;
  await Inquiry.updateOne({ _id: inquiryId, workspaceId }, { $set: { phone: sanitized || null } });

  await ActivityLog.create({
    workspaceId,
    actorUserId: ctx.userId,
    entity: "inquiry",
    entityId: inquiry._id,
    action: "updated",
    diff: { phone: sanitized || null },
  });

  revalidateInquiry(inquiryId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// rescheduleInquirySessionAction
// ---------------------------------------------------------------------------

const rescheduleSessionSchema = z
  .object({
    inquiryId: z.string().refine((v) => mongoose.isValidObjectId(v), { message: "invalid_input" }),
    sessionIndex: z.number().int().min(0),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "invalid_time"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "invalid_time"),
  })
  .refine(
    (v) => {
      const [sh, sm] = v.startTime.split(":").map(Number);
      const [eh, em] = v.endTime.split(":").map(Number);
      return eh * 60 + em > sh * 60 + sm;
    },
    { message: "end_before_start", path: ["endTime"] }
  );

export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>;

/**
 * Reschedule a single session on a "new" inquiry.
 * Blocked if the new slot conflicts with an existing real booking.
 * Idempotent: applying the same payload twice leaves state unchanged.
 */
export async function rescheduleInquirySessionAction(
  input: RescheduleSessionInput
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireOrg();

  const parsed = rescheduleSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "invalid_input" };
  }

  await connectDB();
  const workspaceId = ctx.workspace._id;
  const { inquiryId, sessionIndex, startDate, startTime, endTime } = parsed.data;

  // Tenant isolation: workspaceId always from session, never from client input.
  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId }).lean();
  if (!inquiry) return { error: "not_found" };

  // Only "new" inquiries are reschedulable.
  if (inquiry.status !== "new") return { error: "not_reschedulable" };

  if (sessionIndex >= inquiry.sessions.length) {
    return { error: "session_index_out_of_range" };
  }

  const tz = ctx.workspace.timezone ?? FALLBACK_TZ;

  // Conflict check: block if any real booking occupies the new slot.
  // Exclude own draft booking to avoid self-conflict.
  let conflicts: boolean;
  try {
    conflicts = await sessionConflictsWithBookings(
      workspaceId,
      tz,
      { startDate, startTime, endTime },
      inquiry.draftBookingId
    );
  } catch (err) {
    console.error("[inquiry] reschedule conflict check failed:", err);
    return { error: "conflict_check_failed" };
  }
  if (conflicts) return { error: "conflict" };

  // Build updated sessions list for draft-booking sync (replace only the target index).
  const updatedSessions = inquiry.sessions.map(
    (s: { startDate: string; startTime: string; endTime: string }, i: number) =>
      i === sessionIndex ? { ...s, startDate, startTime, endTime } : { ...s }
  );
  const utcSessions = inquirySessionsToBookingSessions(updatedSessions, tz);
  const firstSessionStart = utcSessions.reduce((a, b) => (a.startAt < b.startAt ? a : b)).startAt;
  const lastSessionEnd = utcSessions.reduce((a, b) => (a.endAt > b.endAt ? a : b)).endAt;

  // Idempotent positional $set inside a transaction; also syncs the draft booking.
  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      await Inquiry.updateOne(
        { _id: inquiryId, workspaceId },
        {
          $set: {
            [`sessions.${sessionIndex}.startDate`]: startDate,
            [`sessions.${sessionIndex}.startTime`]: startTime,
            [`sessions.${sessionIndex}.endTime`]: endTime,
          },
        },
        { session: mongoSession }
      );

      if (inquiry.draftBookingId) {
        await Booking.updateOne(
          { _id: inquiry.draftBookingId, workspaceId },
          { $set: { sessions: utcSessions, firstSessionStart, lastSessionEnd } },
          { session: mongoSession }
        );
      }
    });
  } catch (err) {
    console.error("[inquiry] reschedule transaction failed:", err);
    return { error: "reschedule_failed" };
  } finally {
    await mongoSession.endSession();
  }

  revalidatePath("/inquiries");
  return { ok: true };
}
