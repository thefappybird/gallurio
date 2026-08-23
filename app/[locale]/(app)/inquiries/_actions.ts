"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Inquiry, Booking, ActivityLog, Team, Client } from "@/lib/db/models";
import type { InquiryDoc } from "@/lib/db/models/Inquiry";
import { recordBookingForClient } from "@/lib/db/clientTransactions";
import { isClientMatch } from "@/lib/clients/nameMatch";
import { reconcileClient, type ReconciledField } from "@/lib/clients/reconcile";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";
import { inquirySessionsEditSchema, inquirySessionsToBookingSessions, type InquirySessionsEditInput } from "@/lib/validators/inquiry";
import { DEPOSIT_REQUIRES_TOTAL_MESSAGE } from "@/lib/validators/booking";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import { getShiftsOnDate } from "@/lib/bookings/shift-conflicts";
import { overlappingShifts, toMinutes } from "@/app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers";
import { computeInquiryConflicts, sessionConflictsWithBookings } from "@/lib/db/queries/inquiry-conflicts";
import { sendBookingConfirmedClient, sendBookingConfirmedOwner } from "@/lib/email/booking/bookingConfirmed";
import { sendInquiryDeclineClient } from "@/lib/email/booking/inquiryDecline";
import { resolveWorkspaceBrand } from "@/lib/email/brand";
import { emailLocale } from "@/lib/email/messages";
import { resolveTeamRecipients } from "@/lib/notifications/recipients";
import { sendNotification } from "@/lib/notifications/send";
import { getInquiryWithDraft } from "@/lib/db/queries/inquiries";
import type { InquiryDetailModalData } from "./_components/inquiry-detail-modal";

// The status a draft is promoted to on approval. Approval skips the old
// "inquiry" pipeline state and lands directly on "booked". Drafts are the
// only state hidden from the calendar.
const PROMOTED_STATUS = "booked" as const;

/** True when an active client other than the inquiry's own plausibly matches it. */
async function inquiryHasUnresolvedClientMatch(
  workspaceId: mongoose.Types.ObjectId,
  inquiry: Pick<InquiryDoc, "name" | "email" | "phone" | "clientId" | "clientResolvedAt">
): Promise<boolean> {
  // The owner has already answered this question. Asking again on every approve
  // is unanswerable when two same-name clients both match: picking either
  // leaves the other matching.
  if (inquiry.clientResolvedAt) return false;

  const candidates = await Client.find(
    { workspaceId, isActive: true },
    { name: 1, email: 1, phone: 1 }
  )
    .limit(5000)
    .lean();

  return candidates.some(
    (c) =>
      String(c._id) !== String(inquiry.clientId ?? "") &&
      isClientMatch(
        { name: inquiry.name, email: inquiry.email, phone: inquiry.phone },
        { name: c.name, email: c.email, phone: c.phone }
      )
  );
}

export type InquiryActionResult =
  | { ok: true; bookingId?: string; idempotent?: boolean; clientId?: string }
  | { error: string };

/**
 * Loads one inquiry for the table detail modal without navigating the entire
 * inquiries page (and consequently re-fetching its table).
 */
export async function getInquiryDetailAction(
  inquiryId: string,
  locale: string
): Promise<{ ok: true; detail: InquiryDetailModalData } | { error: string }> {
  const ctx = await requireOrg();
  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  const result = await getInquiryWithDraft(ctx.workspace._id, inquiryId);
  if (!result) return { error: "not_found" };

  const { inquiry, booking } = result;
  const detailId = String(inquiry._id);
  const timezone = ctx.workspace.timezone ?? FALLBACK_TZ;
  const hasConflict = isBookedInquiryStatus(inquiry.status)
    ? false
    : (
        await computeInquiryConflicts(
          ctx.workspace._id,
          [
            {
              _id: detailId,
              sessions: (inquiry.sessions ?? []).map((session) => ({
                startDate: (session as { startDate: string }).startDate,
                startTime: (session as { startTime: string }).startTime,
                endTime: (session as { endTime: string }).endTime,
              })),
            },
          ],
          timezone
        )
      ).has(detailId);

  return {
    ok: true,
    detail: {
      inquiryId: detailId,
      locale,
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone ?? null,
      preferredContact: inquiry.preferredContact ?? "email",
      status: inquiry.status,
      eventType: inquiry.eventType ?? "other",
      guestCount: inquiry.guestCount ?? null,
      location: inquiry.location ?? null,
      message: inquiry.message ?? "",
      sessions: inquiry.sessions ?? [],
      submittedAt: inquiry.createdAt.toISOString(),
      updatedAt: inquiry.updatedAt.toISOString(),
      bookingMissing: booking === null,
      booking: booking
        ? {
            id: String(booking._id),
            currency: booking.amount?.currency ?? ctx.workspace.currency ?? "PHP",
            total: booking.amount?.total ?? 0,
            deposit: booking.amount?.deposit ?? 0,
            notes: booking.notes ?? "",
            teamId: booking.teamId ? String(booking.teamId) : null,
          }
        : null,
      isOwner: ctx.role === "owner",
      hasConflict,
    },
  };
}

export type InquiryClientMatch = {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Carried so the resolve dialog can surface a notes conflict, not just email/phone. */
  notes: string | null;
  tags: string[];
  source: "form" | "manual" | "referral" | "import";
  bookingsCount: number;
  totalSpent: number;
  createdAt: string;
};

/**
 * Clients that plausibly describe the same person as the inquiry's typed
 * contact details, excluding whoever the inquiry already points at. Owner-only.
 * Computed live on demand — no stored flag, nothing to invalidate.
 */
export async function findInquiryClientMatchesAction(
  inquiryId: string
): Promise<{ ok: true; matches: InquiryClientMatch[] } | { error: string }> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne(
    { _id: inquiryId, workspaceId },
    "name email phone clientId"
  ).lean();
  if (!inquiry) return { error: "not_found" };

  // The reversed-name ordering isn't expressible as a Mongo query — fetch
  // active clients and filter in memory.
  const candidates = await Client.find(
    { workspaceId, isActive: true },
    { name: 1, email: 1, phone: 1, notes: 1, tags: 1, source: 1, bookingsCount: 1, totalSpent: 1, createdAt: 1 }
  )
    .limit(5000)
    .lean();

  const matches: InquiryClientMatch[] = candidates
    .filter((c) => String(c._id) !== String(inquiry.clientId ?? ""))
    .filter((c) =>
      isClientMatch(
        { name: inquiry.name, email: inquiry.email, phone: inquiry.phone },
        { name: c.name, email: c.email, phone: c.phone }
      )
    )
    .map((c) => ({
      _id: String(c._id),
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      notes: c.notes ?? null,
      tags: c.tags ?? [],
      source: c.source ?? "manual",
      bookingsCount: c.bookingsCount ?? 0,
      totalSpent: c.totalSpent ?? 0,
      createdAt: c.createdAt.toISOString(),
    }));

  return { ok: true, matches };
}

const clientIdSchema = z.string().refine((v) => mongoose.isValidObjectId(v), {
  message: "invalid_input",
});

const clientResolutionPicksSchema = z.object({
  email: z.enum(["existing", "typed"]).optional(),
  phone: z.enum(["existing", "typed"]).optional(),
  notes: z.enum(["existing", "typed"]).optional(),
});

const inquiryClientResolutionSchema = z.union([
  z.object({ clientId: clientIdSchema, picks: clientResolutionPicksSchema }),
  z.object({ createNew: z.literal(true) }),
]);

export type InquiryClientResolutionInput = z.infer<typeof inquiryClientResolutionSchema>;

/**
 * Re-link an inquiry (and its draft booking) to a different client — a
 * re-link, not a plain link, because the draft Booking created at submission
 * time already points somewhere and Booking.clientId is required. Reconciles
 * the target client's fields against what the inquiry typed and applies the
 * caller's picks for genuine conflicts.
 */
export async function resolveInquiryClientAction(
  inquiryId: string,
  resolution: InquiryClientResolutionInput
): Promise<InquiryActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  const parsed = inquiryClientResolutionSchema.safeParse(resolution);
  if (!parsed.success) return { error: "invalid_input" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId });
  if (!inquiry) return { error: "not_found" };

  let targetClientId: mongoose.Types.ObjectId | undefined;
  let targetClientName: string | undefined;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if ("clientId" in parsed.data) {
        const { clientId, picks } = parsed.data;
        // Re-validate against the workspace — a client id from a request body
        // is untrusted input; a foreign id must fail like a nonexistent one.
        const target = await Client.findOne({ _id: clientId, workspaceId }, null, { session }).lean();
        if (!target) throw new Error("target_not_found");

        const reconciled = reconcileClient(target, {
          email: inquiry.email,
          phone: inquiry.phone,
          notes: inquiry.message,
        });

        const set: Partial<Record<ReconciledField, string>> = {};
        for (const change of reconciled.additive) set[change.field] = change.value;
        for (const conflict of reconciled.conflicts) {
          if (picks[conflict.field] === "typed") set[conflict.field] = conflict.typedValue;
        }
        const $set: Record<string, unknown> = { ...set };
        if (reconciled.tags) $set.tags = reconciled.tags;
        if (Object.keys($set).length > 0) {
          await Client.updateOne({ _id: clientId, workspaceId }, { $set }, { session });
        }

        targetClientId = target._id;
        targetClientName = target.name;
      } else {
        const [created] = await Client.create(
          [
            {
              workspaceId,
              name: inquiry.name,
              email: inquiry.email,
              phone: inquiry.phone,
              source: "form",
            },
          ],
          { session }
        );
        targetClientId = created._id;
        targetClientName = created.name;
      }

      await Inquiry.updateOne(
        { _id: inquiry._id, workspaceId },
        { $set: { clientId: targetClientId, clientResolvedAt: new Date() } },
        { session }
      );

      if (inquiry.draftBookingId) {
        await Booking.updateOne(
          { _id: inquiry.draftBookingId, workspaceId },
          { $set: { clientId: targetClientId, clientName: targetClientName } },
          { session }
        );
      }

      await ActivityLog.create(
        [
          {
            workspaceId,
            actorUserId: ctx.userId,
            entity: "inquiry",
            entityId: inquiry._id,
            action: "client_changed",
            meta: {
              from: inquiry.clientId ? String(inquiry.clientId) : null,
              to: String(targetClientId),
            },
          },
        ],
        { session }
      );

      const previousClientId = inquiry.clientId;
      if (previousClientId && String(previousClientId) !== String(targetClientId)) {
        const orphan = await Client.findOne({ _id: previousClientId, workspaceId }, null, { session }).lean();
        const guardsPass =
          !!orphan &&
          orphan.source === "form" &&
          (orphan.bookingsCount ?? 0) === 0 &&
          (orphan.totalSpent ?? 0) === 0 &&
          (orphan.transactions?.length ?? 0) === 0;

        if (guardsPass) {
          const [referencedByOtherInquiry, referencedByOtherBooking] = await Promise.all([
            Inquiry.exists({ workspaceId, clientId: previousClientId, _id: { $ne: inquiry._id } }).session(session),
            // Mongoose drops an undefined value from a filter, so a missing
            // draftBookingId would silently turn this into "any booking at
            // all" rather than "any booking except the draft". Spell it out.
            Booking.exists(
              inquiry.draftBookingId
                ? { workspaceId, clientId: previousClientId, _id: { $ne: inquiry.draftBookingId } }
                : { workspaceId, clientId: previousClientId }
            ).session(session),
          ]);

          if (!referencedByOtherInquiry && !referencedByOtherBooking) {
            // This deletes on relink rather than deferring client and draft-booking creation to approval. Deferring would rewrite the draft-booking call sites, inquiry conflict detection, calendar overlay, and booking-draft-card editing flow.
            await Client.deleteOne({ _id: previousClientId, workspaceId }, { session });
          } else {
            console.warn(
              `[inquiry] resolveClient: client ${previousClientId} still referenced by another inquiry/booking — not deleted`
            );
          }
        } else if (orphan) {
          console.warn(
            `[inquiry] resolveClient: client ${previousClientId} accumulated real state — not deleted`
          );
        }
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "target_not_found") {
      return { error: "not_found" };
    }
    console.error("[inquiry] resolveClient transaction failed:", err);
    return { error: "resolve_failed" };
  } finally {
    await session.endSession();
  }

  if (!targetClientId) return { error: "resolve_failed" };

  return { ok: true, clientId: targetClientId.toString() };
}

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

  // Gate promotion on client resolution: an unresolved matching client means
  // this inquiry's auto-created client may be a duplicate of someone already
  // in the CRM. The owner must resolve it via resolveInquiryClientAction
  // before the draft can be promoted.
  const hasUnresolvedClientMatch = await inquiryHasUnresolvedClientMatch(workspaceId, inquiry);
  if (hasUnresolvedClientMatch) return { error: "needs_client_resolution" };

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

  // A deposit is meaningless without a price — reject the merged amount, not
  // just the edits, so a deposit-only edit over a zero-total draft is caught.
  if (newAmount.deposit > 0 && newAmount.total <= 0) {
    return { error: DEPOSIT_REQUIRES_TOTAL_MESSAGE };
  }

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
      logoUrl: ctx.workspace.logoUrl,
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

  // When an amount field is edited, validate the MERGED amount (edit over the
  // draft's current value) so a deposit-only patch over a zero-total draft is
  // rejected — the patch alone can't see the existing total.
  if (edits.data.total !== undefined || edits.data.deposit !== undefined) {
    const draft = await Booking.findOne(
      { _id: inquiry.draftBookingId, workspaceId },
      { amount: 1 }
    ).lean();
    const effTotal = edits.data.total ?? draft?.amount?.total ?? 0;
    const effDeposit = edits.data.deposit ?? draft?.amount?.deposit ?? 0;
    if (effDeposit > 0 && effTotal <= 0) {
      return { error: DEPOSIT_REQUIRES_TOTAL_MESSAGE };
    }
  }

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

  // Archive (silent dismiss) and the orphan-draft cancel commit together so an
  // archived inquiry never leaves a dangling "draft" booking. No email.
  let archived = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const res = await Inquiry.updateOne(
        { _id: inquiryId, workspaceId: ctx.workspace._id, status: { $nin: ["booked", "converted"] } },
        { $set: { status: "archived" } },
        { session }
      );
      if (res.matchedCount === 0) return;
      archived = true;

      if (inquiry.draftBookingId) {
        await Booking.updateOne(
          { _id: inquiry.draftBookingId, workspaceId: ctx.workspace._id, status: "draft" },
          { $set: { status: "cancelled" } },
          { session }
        );
      }

      await ActivityLog.create(
        [
          {
            workspaceId: ctx.workspace._id,
            actorUserId: ctx.userId,
            entity: "inquiry",
            entityId: inquiry._id,
            action: "status_changed",
            meta: { from: inquiry.status, to: "archived" },
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  if (!archived) return { error: "not_found" };

  revalidateInquiry(inquiryId);
  return { ok: true };
}

/**
 * Decline an inquiry: set it archived, cancel the orphan draft booking,
 * and send a polite decline email to the client.
 * Booked/converted inquiries cannot be declined.
 */
export async function declineInquiryAction(inquiryId: string): Promise<InquiryActionResult> {
  const ctx = await requireOrg();

  if (!mongoose.isValidObjectId(inquiryId)) return { error: "not_found" };

  await connectDB();

  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne({
    _id: inquiryId,
    workspaceId,
    status: { $nin: ["booked", "converted"] },
  }).lean();
  if (!inquiry) return { error: "not_found" };

  // Did THIS call archive the inquiry? A concurrent archive/decline/approval can
  // win the status guard (matchedCount === 0); only the winner emails the client
  // and reports success, so the loser must not double-notify.
  let declined = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const res = await Inquiry.updateOne(
        { _id: inquiryId, workspaceId, status: { $nin: ["booked", "converted"] } },
        { $set: { status: "archived" } },
        { session }
      );
      if (res.matchedCount === 0) return;
      declined = true;

      if (inquiry.draftBookingId) {
        await Booking.updateOne(
          { _id: inquiry.draftBookingId, workspaceId, status: "draft" },
          { $set: { status: "cancelled" } },
          { session }
        );
      }

      await ActivityLog.create(
        [
          {
            workspaceId,
            actorUserId: ctx.userId,
            entity: "inquiry",
            entityId: inquiry._id,
            action: "status_changed",
            meta: { from: inquiry.status, to: "archived", via: "decline" },
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  // A concurrent archive/decline/approval already resolved this inquiry — report
  // not_found without emailing (this call did not decline it).
  if (!declined) return { error: "not_found" };

  // Best-effort decline email — never throws, never rolls back.
  const ownerEmail = ctx.workspace.contact?.email ?? null;
  void (async () => {
    try {
      const client = await Client.findOne(
        { _id: inquiry.clientId, workspaceId },
        { email: 1, name: 1 }
      )
        .lean()
        .catch(() => null);

      if (client?.email) {
        const brand = resolveWorkspaceBrand({
          name: ctx.workspace.name,
          logoUrl: ctx.workspace.logoUrl,
          publicPage: ctx.workspace.publicPage
            ? {
                header: { logoUrl: ctx.workspace.publicPage.header?.logoUrl },
                brandKit: { accentColor: ctx.workspace.publicPage.brandKit?.accentColor },
              }
            : undefined,
          contact: ownerEmail ? { email: ownerEmail } : undefined,
        });

        await sendInquiryDeclineClient({
          brand,
          locale: ctx.workspace.country ?? null,
          clientName: client.name,
          clientEmail: client.email,
          businessName: ctx.workspace.name,
          replyTo: ownerEmail,
        });
      }
    } catch {
      // Best-effort: ignore errors
    }
  })();

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
 * Reschedule a single session on an "inquiry" status inquiry.
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

  // Only "inquiry" status inquiries are reschedulable.
  if (inquiry.status !== "inquiry") return { error: "not_reschedulable" };

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
