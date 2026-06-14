"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Inquiry, Booking, ActivityLog } from "@/lib/db/models";
import { recordBookingForClient } from "@/lib/db/clientTransactions";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";

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
  })
  .refine((v) => v.deposit === undefined || v.total === undefined || v.deposit <= v.total, {
    message: "Deposit cannot exceed the total",
    path: ["deposit"],
  });

export type DraftEdits = z.infer<typeof draftEditsSchema>;

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

  const edits = draftEditsSchema.safeParse(draftEdits ?? {});
  if (!edits.success) {
    return { error: edits.error.errors[0]?.message ?? "invalid_input" };
  }

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId });
  if (!inquiry) return { error: "not_found" };

  // Idempotency: already approved → return the existing booking, do nothing.
  if (isBookedInquiryStatus(inquiry.status) && inquiry.convertedBookingId) {
    return { ok: true, bookingId: inquiry.convertedBookingId.toString(), idempotent: true };
  }

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

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Promote the draft. The `status: "draft"` guard makes the write a no-op
      // if a concurrent approval already promoted it — belt-and-suspenders with
      // the idempotency check above.
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

      // A concurrent approval already promoted this draft — skip recording so
      // the client isn't double-credited. Returning commits this (empty) txn;
      // the caller still resolves ok since the booking is promoted either way.
      if (promoted.matchedCount === 0) return;

      // Now the booking is real, fold it into the client's financial footprint
      // (mirrors the manual booking-create flow — drafts are deliberately not
      // recorded, so this is the first and only time this booking is counted).
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

  if (Object.keys(set).length > 0) {
    await Booking.updateOne(
      { _id: inquiry.draftBookingId, workspaceId, status: "draft" },
      { $set: set }
    );
  }

  revalidateInquiry(inquiryId);
  return { ok: true };
}

/** Triage: approve an inquiry (status "new" -> "approved"). No booking effect. Owner or staff. */
export async function approveInquiryAction(inquiryId: string): Promise<InquiryActionResult> {
  const ctx = await requireOrg();
  await connectDB();

  const res = await Inquiry.updateOne(
    { _id: inquiryId, workspaceId: ctx.workspace._id, status: { $in: ["new", "approved"] } },
    { $set: { status: "approved" } }
  );
  if (res.matchedCount === 0) return { error: "not_found" };

  revalidateInquiry(inquiryId);
  return { ok: true };
}

/** Triage: archive an inquiry. Booked inquiries cannot be archived. */
export async function archiveInquiryAction(inquiryId: string): Promise<InquiryActionResult> {
  const ctx = await requireOrg();
  await connectDB();

  const res = await Inquiry.updateOne(
    {
      _id: inquiryId,
      workspaceId: ctx.workspace._id,
      status: { $nin: ["booked", "converted"] },
    },
    { $set: { status: "archived" } }
  );
  if (res.matchedCount === 0) return { error: "not_found" };

  revalidateInquiry(inquiryId);
  return { ok: true };
}
