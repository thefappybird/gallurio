import mongoose from "mongoose";
import { Client, Transaction } from "@/lib/db/models";

type RecordBookingOpts = {
  workspaceId: mongoose.Types.ObjectId | string;
  clientId: mongoose.Types.ObjectId | string;
  booking: {
    _id: mongoose.Types.ObjectId;
    amount: { total: number; deposit: number; currency: string };
    firstSessionStart: Date;
  };
  source: "manual" | "import" | "webhook" | "seed";
};

export async function recordBookingForClient(opts: RecordBookingOpts): Promise<void> {
  const { workspaceId, clientId, booking, source } = opts;

  const type = booking.amount.deposit > 0 ? "deposit" : "other";
  const amount = booking.amount.deposit > 0 ? booking.amount.deposit : booking.amount.total;
  const currency = booking.amount.currency;
  const occurredAt = booking.firstSessionStart;

  const txDoc = await Transaction.create({
    workspaceId,
    bookingId: booking._id,
    clientId,
    amount,
    currency,
    type,
    method: "other",
    paidAt: occurredAt,
  });

  const entry = {
    bookingId: booking._id,
    transactionId: txDoc._id,
    amount,
    currency,
    type,
    occurredAt,
    source,
  };

  const result = await Client.updateOne(
    { _id: clientId, workspaceId },
    {
      $inc: { totalSpent: amount, bookingsCount: 1 },
      $max: { lastBookingAt: occurredAt, lastPaymentDate: occurredAt },
      $set: { lastPaymentAmount: amount },
      $push: { transactions: { $each: [entry], $slice: -200 } },
    }
  );

  if (result.matchedCount === 0) {
    const err = new Error(
      `recordBookingForClient: client not found — clientId=${clientId} workspaceId=${workspaceId}`
    );
    console.error(err.message);
    throw err;
  }
}
