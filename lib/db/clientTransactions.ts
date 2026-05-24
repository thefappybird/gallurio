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

  const clientExists = await Client.exists({ _id: clientId, workspaceId });
  if (!clientExists) {
    throw new Error(
      `recordBookingForClient: client not found — clientId=${clientId} workspaceId=${workspaceId}`
    );
  }

  const deposit = booking.amount.deposit;
  const currency = booking.amount.currency;
  const occurredAt = booking.firstSessionStart;

  if (deposit > 0) {
    const txDoc = await Transaction.create({
      workspaceId,
      bookingId: booking._id,
      clientId,
      amount: deposit,
      currency,
      type: "deposit",
      method: "other",
      paidAt: occurredAt,
    });

    const entry = {
      bookingId: booking._id,
      transactionId: txDoc._id,
      amount: deposit,
      currency,
      type: "deposit",
      occurredAt,
      source,
    };

    await Client.updateOne(
      { _id: clientId, workspaceId },
      {
        $inc: { totalSpent: deposit, bookingsCount: 1 },
        $max: { lastBookingAt: occurredAt, lastPaymentDate: occurredAt },
        $set: { lastPaymentAmount: deposit },
        $push: { transactions: { $each: [entry], $slice: -200 } },
      }
    );
  } else {
    const entry = {
      bookingId: booking._id,
      transactionId: null,
      amount: 0,
      currency,
      type: "other",
      occurredAt,
      source,
    };

    await Client.updateOne(
      { _id: clientId, workspaceId },
      {
        $inc: { bookingsCount: 1 },
        $max: { lastBookingAt: occurredAt },
        $push: { transactions: { $each: [entry], $slice: -200 } },
      }
    );
  }
}
