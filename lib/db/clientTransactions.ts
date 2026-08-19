import mongoose from "mongoose";
import { Client, Transaction } from "@/lib/db/models";

type ReassignBookingOpts = {
  workspaceId: mongoose.Types.ObjectId | string;
  fromClientId: mongoose.Types.ObjectId | string;
  toClientId: mongoose.Types.ObjectId | string;
  booking: {
    _id: mongoose.Types.ObjectId;
    amount: { total: number; deposit: number; currency: string };
    firstSessionStart: Date;
    teamId?: mongoose.Types.ObjectId | string | null;
  };
  session?: mongoose.ClientSession;
};

/**
 * Move a booking's financial footprint from one client to another atomically.
 * Decrements the old client's counters by the booking's deposit, increments
 * the new client's counters, and moves the transaction doc (if any) to the
 * new client. Both sides must belong to the same workspace.
 */
export async function reassignBookingBetweenClients(opts: ReassignBookingOpts): Promise<void> {
  const { workspaceId, fromClientId, toClientId, booking } = opts;

  const runWrites = async (session: mongoose.ClientSession) => {
    // Verify both clients exist in the same workspace.
    const [fromExists, toExists] = await Promise.all([
      Client.exists({ _id: fromClientId, workspaceId }).session(session),
      Client.exists({ _id: toClientId, workspaceId }).session(session),
    ]);
    if (!fromExists) {
      throw new Error(`reassignBookingBetweenClients: fromClient not found — clientId=${fromClientId}`);
    }
    if (!toExists) {
      throw new Error(`reassignBookingBetweenClients: toClient not found — clientId=${toClientId}`);
    }

    const deposit = booking.amount.deposit;
    const currency = booking.amount.currency;
    const occurredAt = booking.firstSessionStart;
    const teamId = booking.teamId ?? null;

    // --- Decrement old client ---
    // A booking can now have a deposit plus several paid payment rows. Remove
    // the whole booking footprint, not just the first matching transaction.
    const oldTransactions = await Transaction.find(
      { workspaceId, bookingId: booking._id, clientId: fromClientId, type: { $in: ["deposit", "balance"] } },
      { amount: 1 },
      { session }
    ).lean();
    const oldPaidTotal = oldTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    await Transaction.deleteMany(
      { workspaceId, bookingId: booking._id, clientId: fromClientId },
      { session }
    );

    // Single-stage aggregation pipeline update for the old client.
    // We use $let to define the filtered transaction array once, then derive all
    // summary fields (lastBookingAt, lastPaymentDate, lastPaymentAmount) from it
    // in the same stage — ensuring they are recomputed from the remaining entries
    // rather than left as stale pointers to the moved booking.
    await Client.updateOne(
      { _id: fromClientId, workspaceId },
      [
        {
          $set: {
            totalSpent: { $max: [{ $subtract: [{ $ifNull: ["$totalSpent", 0] }, oldPaidTotal] }, 0] },
            bookingsCount: { $max: [{ $subtract: [{ $ifNull: ["$bookingsCount", 0] }, 1] }, 0] },
            // Recompute all three summary fields using $let so the filtered array
            // is evaluated once and referenced safely by the derived expressions.
            lastBookingAt: {
              $let: {
                vars: {
                  remaining: {
                    $filter: {
                      input: { $ifNull: ["$transactions", []] },
                      as: "t",
                      cond: { $ne: ["$$t.bookingId", booking._id] },
                    },
                  },
                },
                in: {
                  $cond: [
                    { $eq: [{ $size: "$$remaining" }, 0] },
                    null,
                    {
                      $reduce: {
                        input: "$$remaining",
                        initialValue: new Date(0),
                        in: {
                          $cond: [
                            { $gt: ["$$this.occurredAt", "$$value"] },
                            "$$this.occurredAt",
                            "$$value",
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
            lastPaymentDate: {
              $let: {
                vars: {
                  paymentEntries: {
                    $filter: {
                      input: { $ifNull: ["$transactions", []] },
                      as: "t",
                      cond: {
                        $and: [
                          { $ne: ["$$t.bookingId", booking._id] },
                          { $in: ["$$t.type", ["deposit", "payment"]] },
                        ],
                      },
                    },
                  },
                },
                in: {
                  $cond: [
                    { $eq: [{ $size: "$$paymentEntries" }, 0] },
                    null,
                    {
                      $reduce: {
                        input: "$$paymentEntries",
                        initialValue: new Date(0),
                        in: {
                          $cond: [
                            { $gt: ["$$this.occurredAt", "$$value"] },
                            "$$this.occurredAt",
                            "$$value",
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
            transactions: {
              $filter: {
                input: { $ifNull: ["$transactions", []] },
                as: "t",
                cond: { $ne: ["$$t.bookingId", booking._id] },
              },
            },
          },
        },
      ],
      { session }
    );

    // lastPaymentAmount must be set in a second stage because it depends on
    // lastPaymentDate computed above (pipeline stages run sequentially and each
    // stage can read fields set by the previous one).
    await Client.updateOne(
      { _id: fromClientId, workspaceId },
      [
        {
          $set: {
            lastPaymentAmount: {
              $cond: [
                { $eq: ["$lastPaymentDate", null] },
                null,
                {
                  $let: {
                    vars: {
                      matchingEntry: {
                        $first: {
                          $filter: {
                            input: { $ifNull: ["$transactions", []] },
                            as: "t",
                            cond: {
                              $and: [
                                { $in: ["$$t.type", ["deposit", "payment"]] },
                                { $eq: ["$$t.occurredAt", "$lastPaymentDate"] },
                              ],
                            },
                          },
                        },
                      },
                    },
                    in: { $ifNull: ["$$matchingEntry.amount", null] },
                  },
                },
              ],
            },
          },
        },
      ],
      { session }
    );

    // --- Increment new client ---
    if (deposit > 0) {
      const [txDoc] = await Transaction.create(
        [
          {
            workspaceId,
            bookingId: booking._id,
            teamId,
            clientId: toClientId,
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
        teamId,
        amount: deposit,
        currency,
        type: "deposit",
        occurredAt,
        source: "manual" as const,
      };

      await Client.updateOne(
        { _id: toClientId, workspaceId },
        [
          {
            $set: {
              totalSpent: { $add: [{ $ifNull: ["$totalSpent", 0] }, deposit] },
              bookingsCount: { $add: [{ $ifNull: ["$bookingsCount", 0] }, 1] },
              lastBookingAt: { $max: [{ $ifNull: ["$lastBookingAt", null] }, occurredAt] },
              lastPaymentDate: { $max: [{ $ifNull: ["$lastPaymentDate", null] }, occurredAt] },
              lastPaymentAmount: {
                $cond: [
                  { $gt: [occurredAt, { $ifNull: ["$lastPaymentDate", new Date(0)] }] },
                  deposit,
                  { $ifNull: ["$lastPaymentAmount", 0] },
                ],
              },
              transactions: {
                $slice: [
                  { $concatArrays: [{ $ifNull: ["$transactions", []] }, [entry]] },
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
        teamId,
        amount: 0,
        currency,
        type: "other",
        occurredAt,
        source: "manual" as const,
      };

      await Client.updateOne(
        { _id: toClientId, workspaceId },
        [
          {
            $set: {
              bookingsCount: { $add: [{ $ifNull: ["$bookingsCount", 0] }, 1] },
              lastBookingAt: { $max: [{ $ifNull: ["$lastBookingAt", null] }, occurredAt] },
              transactions: {
                $slice: [
                  { $concatArrays: [{ $ifNull: ["$transactions", []] }, [entry]] },
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
    await runWrites(opts.session);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() => runWrites(session));
    } finally {
      await session.endSession();
    }
  }
}

type RecordBookingOpts = {
  workspaceId: mongoose.Types.ObjectId | string;
  clientId: mongoose.Types.ObjectId | string;
  booking: {
    _id: mongoose.Types.ObjectId;
    amount: {
      total: number;
      deposit: number;
      currency: string;
      fxRate?: number | null;
      fxTarget?: string | null;
      fxAt?: Date | null;
    };
    firstSessionStart: Date;
    teamId?: mongoose.Types.ObjectId | string | null;
  };
  source: "manual" | "import" | "webhook" | "seed";
  session?: mongoose.ClientSession;
};

type SyncBookingPaymentsOpts = {
  workspaceId: mongoose.Types.ObjectId | string;
  clientId: mongoose.Types.ObjectId | string;
  booking: {
    _id: mongoose.Types.ObjectId;
    teamId?: mongoose.Types.ObjectId | string | null;
    amount: { currency: string };
    payments: Array<{
      price: number;
      status: "unpaid" | "paid";
      title?: string;
      method?: "cash" | "card" | "remit";
      paidAt?: Date | null;
      fxRate?: number | null;
      fxTarget?: string | null;
      fxAt?: Date | null;
    }>;
  };
  session?: mongoose.ClientSession;
};

/**
 * Makes the transaction ledger the faithful projection of a booking's paid
 * payment rows. Booking payments have no stable id, so replacing the derived
 * balance entries is safer than attempting positional diffs. Client spending
 * is then recomputed from the ledger, which also fixes older clients whose
 * summary pre-dates payment rows.
 */
export async function syncBookingPaymentsForClient(opts: SyncBookingPaymentsOpts): Promise<void> {
  const { workspaceId, clientId, booking } = opts;
  const run = async (session: mongoose.ClientSession) => {
    await Transaction.deleteMany(
      { workspaceId, clientId, bookingId: booking._id, type: "balance" },
      { session }
    );

    const paid = booking.payments.filter((payment) => payment.status === "paid" && payment.price > 0);
    if (paid.length > 0) {
      await Transaction.create(
        paid.map((payment) => ({
          workspaceId,
          bookingId: booking._id,
          teamId: booking.teamId ?? null,
          clientId,
          amount: payment.price,
          currency: booking.amount.currency,
          type: "balance" as const,
          method: payment.method ?? "cash",
          notes: payment.title ?? "",
          paidAt: payment.paidAt ?? new Date(),
          // Copied, not recomputed — this survives the deleteMany+recreate
          // cycle above. The rate itself is frozen once by normalizePayments
          // at write time; deriving it again here would re-freeze on every edit.
          fxRate: payment.fxRate ?? null,
          fxTarget: payment.fxTarget ?? null,
          fxAt: payment.fxAt ?? null,
        })),
        { session }
      );
    }

    // Deliberately a raw sum in the recorded currencies: totalSpent is stored
    // unconverted and converted at read time against current rates
    // (lib/pricing/clientTotals.ts), so it never disagrees with the dashboard
    // roll-up. Do not convert here — that would freeze a write-time rate into
    // the field and make the two views drift apart.
    const [summary] = await Transaction.aggregate<{
      total: number;
      lastPaymentDate: Date | null;
      lastPaymentAmount: number | null;
    }>([
      { $match: { workspaceId, clientId, type: { $in: ["deposit", "balance"] } } },
      { $sort: { paidAt: -1, _id: -1 } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          lastPaymentDate: { $first: "$paidAt" },
          lastPaymentAmount: { $first: "$amount" },
        },
      },
    ]).session(session);

    await Client.updateOne(
      { _id: clientId, workspaceId },
      {
        $set: {
          totalSpent: summary?.total ?? 0,
          lastPaymentDate: summary?.lastPaymentDate ?? null,
          lastPaymentAmount: summary?.lastPaymentAmount ?? 0,
        },
      },
      { session }
    );
  };

  if (opts.session) return run(opts.session);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => run(session));
  } finally {
    await session.endSession();
  }
}

export async function recordBookingForClient(opts: RecordBookingOpts): Promise<void> {
  const { workspaceId, clientId, booking, source } = opts;

  // Precheck: verify the client exists before performing writes. When the caller
  // supplies a session, the client may have been created in that same transaction
  // and won't be visible outside it — pass the session so the read is consistent.
  const existsQuery = Client.exists({ _id: clientId, workspaceId });
  if (opts.session) existsQuery.session(opts.session);
  const clientExists = await existsQuery;
  if (!clientExists) {
    throw new Error(
      `recordBookingForClient: client not found — clientId=${clientId} workspaceId=${workspaceId}`
    );
  }

  const deposit = booking.amount.deposit;
  const currency = booking.amount.currency;
  const occurredAt = booking.firstSessionStart;
  const teamId = booking.teamId ?? null;

  const runWrites = async (session: mongoose.ClientSession) => {
    if (deposit > 0) {
      const [txDoc] = await Transaction.create(
        [
          {
            workspaceId,
            bookingId: booking._id,
            teamId,
            clientId,
            amount: deposit,
            currency,
            type: "deposit",
            method: "other",
            paidAt: occurredAt,
            // Copied from the booking amount, which the caller freezes (or
            // leaves null on an FX outage) at write time — never recomputed here.
            fxRate: booking.amount.fxRate ?? null,
            fxTarget: booking.amount.fxTarget ?? null,
            fxAt: booking.amount.fxAt ?? null,
          },
        ],
        { session }
      );

      const entry = {
        bookingId: booking._id,
        transactionId: txDoc._id,
        teamId,
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
        teamId,
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
