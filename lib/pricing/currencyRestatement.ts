import mongoose from "mongoose";
import { Booking, Transaction, Workspace } from "@/lib/db/models";
import { getFxRate } from "./fxRates";

// How long an owner must wait before changing the workspace currency again,
// once a change has actually restated at least one paid payment/deposit.
export const CURRENCY_CHANGE_COOLDOWN_DAYS = 90;

// Null while free to change (never changed, or the cooldown has elapsed).
// A non-null Date is the moment the field re-opens.
export function currencyChangeLockedUntil(currencyChangedAt: Date | null): Date | null {
  if (!currencyChangedAt) return null;
  const unlock = new Date(
    currencyChangedAt.getTime() + CURRENCY_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );
  return unlock > new Date() ? unlock : null;
}

type RestatableBooking = {
  _id: mongoose.Types.ObjectId;
  amount: { currency: string; fxRate?: number | null };
};

// Bookings holding at least one already-frozen payment or deposit — the set
// a currency change must restate. Scoped by workspaceId (tenant isolation).
async function findRestatableBookings(
  workspaceId: mongoose.Types.ObjectId | string
): Promise<RestatableBooking[]> {
  return Booking.find(
    {
      workspaceId,
      $or: [{ "payments.fxRate": { $ne: null } }, { "amount.fxRate": { $ne: null } }],
    },
    { "amount.currency": 1, "amount.fxRate": 1 }
  ).lean<RestatableBooking[]>();
}

export async function previewCurrencyRestatement(
  workspaceId: mongoose.Types.ObjectId | string
): Promise<{ bookingsCount: number }> {
  const bookings = await findRestatableBookings(workspaceId);
  return { bookingsCount: bookings.length };
}

export type ChangeWorkspaceCurrencyResult =
  | { ok: true; restated: boolean }
  | { ok: false; error: "currency_change_locked"; unlockDate: Date }
  | { ok: false; error: "fx_rate_unavailable" };

/**
 * Gate + restate a workspace currency change.
 *
 * - No-op when the currency isn't actually changing.
 * - Rejects while the 90-day cooldown from a prior restating change is active.
 * - Resolves today's rate for every distinct source currency among the
 *   restatable bookings BEFORE any write; if any is unresolvable, aborts
 *   with no writes at all (all-or-nothing — a half-restated workspace mixes
 *   two bases in one total with no way for the user to tell).
 * - Re-freezes each row from its ORIGINAL amount.currency at today's rate —
 *   never chained off the already-frozen fxTarget, which would compound a
 *   second conversion into a number meant to be exact.
 * - Writes Booking.payments[].fx*, Booking.amount.fx*, the derived
 *   Transaction fx* copies, and Workspace.currency/currencyChangedAt in one
 *   transaction. currencyChangedAt is stamped only when something was
 *   actually restated — a workspace with no paid money stays freely editable.
 */
export async function changeWorkspaceCurrency(opts: {
  workspaceId: mongoose.Types.ObjectId | string;
  currentCurrency: string;
  currentCurrencyChangedAt: Date | null;
  newCurrency: string;
  /**
   * Join the caller's transaction instead of opening one. The settings action
   * passes its own session so a later failure in the same submit (a duplicate
   * slug, say) rolls the restatement back with it.
   */
  session?: mongoose.ClientSession;
}): Promise<ChangeWorkspaceCurrencyResult> {
  const { workspaceId, currentCurrencyChangedAt } = opts;
  const from = opts.currentCurrency.toUpperCase();
  const to = opts.newCurrency.toUpperCase();

  if (from === to) return { ok: true, restated: false };

  const lockedUntil = currencyChangeLockedUntil(currentCurrencyChangedAt);
  if (lockedUntil) {
    return { ok: false, error: "currency_change_locked", unlockDate: lockedUntil };
  }

  const bookings = await findRestatableBookings(workspaceId);
  if (bookings.length === 0) {
    // Nothing to restate — persist the currency but leave currencyChangedAt
    // untouched so the cooldown never engages for a workspace with no paid
    // money.
    await Workspace.updateOne(
      { _id: workspaceId },
      { $set: { currency: to } },
      { session: opts.session }
    );
    return { ok: true, restated: false };
  }

  const currencies = [...new Set(bookings.map((b) => b.amount.currency.toUpperCase()))];

  // Resolve every distinct source currency's rate before any write.
  const rateEntries = await Promise.all(
    currencies.map(async (c) => [c, await getFxRate(c, to)] as const)
  );
  if (rateEntries.some(([, rate]) => rate === null)) {
    return { ok: false, error: "fx_rate_unavailable" };
  }
  const rateByCurrency = new Map(rateEntries.map(([c, rate]) => [c, rate as number]));

  const idsByCurrency = new Map<string, mongoose.Types.ObjectId[]>();
  for (const booking of bookings) {
    const c = booking.amount.currency.toUpperCase();
    const list = idsByCurrency.get(c) ?? [];
    list.push(booking._id);
    idsByCurrency.set(c, list);
  }

  const now = new Date();

  const writes = async (session: mongoose.ClientSession) => {
    {
      for (const [currency, ids] of idsByCurrency) {
        const rate = rateByCurrency.get(currency)!;

        await Booking.updateMany(
          { workspaceId, _id: { $in: ids }, "payments.fxRate": { $ne: null } },
          {
            $set: {
              "payments.$[elem].fxRate": rate,
              "payments.$[elem].fxTarget": to,
              "payments.$[elem].fxAt": now,
            },
          },
          { arrayFilters: [{ "elem.fxRate": { $ne: null } }], session }
        );

        await Booking.updateMany(
          { workspaceId, _id: { $in: ids }, "amount.fxRate": { $ne: null } },
          { $set: { "amount.fxRate": rate, "amount.fxTarget": to, "amount.fxAt": now } },
          { session }
        );

        await Transaction.updateMany(
          {
            workspaceId,
            bookingId: { $in: ids },
            type: { $in: ["deposit", "balance"] },
            fxRate: { $ne: null },
          },
          { $set: { fxRate: rate, fxTarget: to, fxAt: now } },
          { session }
        );
      }

      await Workspace.updateOne(
        { _id: workspaceId },
        { $set: { currency: to, currencyChangedAt: now } },
        { session }
      );
    }
  };

  if (opts.session) {
    // Already inside the caller's transaction — it owns commit and abort, so a
    // later failure in the same submit rolls this restatement back too.
    await writes(opts.session);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() => writes(session));
    } finally {
      await session.endSession();
    }
  }

  return { ok: true, restated: true };
}
