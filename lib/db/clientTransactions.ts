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
  session?: mongoose.ClientSession;
};

export async function recordBookingForClient(opts: RecordBookingOpts): Promise<void> {
  const { workspaceId, clientId, booking, source } = opts;

  // Precheck outside the transaction — it's a read-only guard and avoids
  // starting a session when the client doesn't exist at all.
  const clientExists = await Client.exists({ _id: clientId, workspaceId });
  if (!clientExists) {
    throw new Error(
      `recordBookingForClient: client not found — clientId=${clientId} workspaceId=${workspaceId}`
    );
  }

  const deposit = booking.amount.deposit;
  const currency = booking.amount.currency;
  const occurredAt = booking.firstSessionStart;

  const runWrites = async (session: mongoose.ClientSession) => {
    if (deposit > 0) {
      const [txDoc] = await Transaction.create(
        [
          {
            workspaceId,
            bookingId: booking._id,
            clientId,
            amount: deposit,
            currency,
            type: "deposit",
            method: "other",
            paidAt: occurredAt,
          },
        ],
        { session }
      );

      const entry = {
        bookingId: booking._id,
        transactionId: txDoc._id,
        amount: deposit,
        currency,
        type: "deposit",
        occurredAt,
        source,
      };

      // Aggregation-pipeline update: $inc/$push/$max operators are unavailable
      // in pipeline form — use $add, $max, $concatArrays+$slice equivalents.
      // lastPaymentAmount only advances when this entry's date is newer than the
      // current lastPaymentDate, preventing back-dated imports from overwriting
      // a more-recent payment amount.
      await Client.updateOne(
        { _id: clientId, workspaceId },
        [
          {
            $set: {
              totalSpent: { $add: [{ $ifNull: ["$totalSpent", 0] }, deposit] },
              bookingsCount: { $add: [{ $ifNull: ["$bookingsCount", 0] }, 1] },
              lastBookingAt: {
                $max: [{ $ifNull: ["$lastBookingAt", null] }, occurredAt],
              },
              lastPaymentDate: {
                $max: [{ $ifNull: ["$lastPaymentDate", null] }, occurredAt],
              },
              lastPaymentAmount: {
                $cond: [
                  {
                    $gt: [
                      occurredAt,
                      { $ifNull: ["$lastPaymentDate", new Date(0)] },
                    ],
                  },
                  deposit,
                  { $ifNull: ["$lastPaymentAmount", 0] },
                ],
              },
              transactions: {
                $slice: [
                  {
                    $concatArrays: [
                      { $ifNull: ["$transactions", []] },
                      [entry],
                    ],
                  },
                  -200,
                ],
              },
            },
          },
        ],
        { session }
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
        [
          {
            $set: {
              bookingsCount: { $add: [{ $ifNull: ["$bookingsCount", 0] }, 1] },
              lastBookingAt: {
                $max: [{ $ifNull: ["$lastBookingAt", null] }, occurredAt],
              },
              transactions: {
                $slice: [
                  {
                    $concatArrays: [
                      { $ifNull: ["$transactions", []] },
                      [entry],
                    ],
                  },
                  -200,
                ],
              },
            },
          },
        ],
        { session }
      );
    }
  };

  if (opts.session) {
    // Caller is managing the transaction — run writes inside their session.
    await runWrites(opts.session);
  } else {
    // No external session: create our own and wrap in withTransaction so that
    // both writes are atomic. If Client.updateOne fails, Transaction.create
    // rolls back automatically.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() => runWrites(session));
    } finally {
      await session.endSession();
    }
  }
}
