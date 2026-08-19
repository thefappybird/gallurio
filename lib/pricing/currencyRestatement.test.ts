/**
 * A workspace currency change must restate every already-frozen payment/
 * deposit at today's rate — otherwise their fxTarget stops matching the new
 * workspace currency and they silently fall back to live conversion, which
 * is the exact drift the freeze exists to prevent. All-or-nothing: if any
 * distinct source currency's rate can't be resolved, nothing is written.
 *
 * Uses real collections (in-memory Mongo) — never mock Mongoose.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";

const getFxRateMock = vi.fn();
vi.mock("./fxRates", () => ({ getFxRate: (...args: unknown[]) => getFxRateMock(...args) }));

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
  getFxRateMock.mockReset();
});

describe("currencyChangeLockedUntil", () => {
  it("returns null when currencyChangedAt is null (never changed — freely editable)", async () => {
    const { currencyChangeLockedUntil } = await import("./currencyRestatement");
    expect(currencyChangeLockedUntil(null)).toBeNull();
  });

  it("returns an unlock date when the change happened fewer than 90 days ago", async () => {
    const { currencyChangeLockedUntil } = await import("./currencyRestatement");
    const changedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const unlock = currencyChangeLockedUntil(changedAt);
    expect(unlock).not.toBeNull();
    expect(unlock!.getTime()).toBeCloseTo(changedAt.getTime() + 90 * 24 * 60 * 60 * 1000, -3);
  });

  it("returns null once 90 days have passed since the change", async () => {
    const { currencyChangeLockedUntil } = await import("./currencyRestatement");
    const changedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    expect(currencyChangeLockedUntil(changedAt)).toBeNull();
  });
});

describe("previewCurrencyRestatement", () => {
  it("returns 0 for a workspace with no frozen payments or deposits", async () => {
    const { previewCurrencyRestatement } = await import("./currencyRestatement");
    const workspaceId = new (await import("mongoose")).default.Types.ObjectId();

    const preview = await previewCurrencyRestatement(workspaceId);

    expect(preview).toEqual({ bookingsCount: 0 });
  });

  it("counts bookings that carry a frozen payment or deposit rate, excluding unfrozen ones", async () => {
    const mongoose = (await import("mongoose")).default;
    const { Booking } = await import("@/lib/db/models");
    const workspaceId = new mongoose.Types.ObjectId();

    await Booking.collection.insertMany([
      {
        workspaceId,
        amount: { total: 100, deposit: 20, currency: "USD", fxRate: 58, fxTarget: "PHP" },
        payments: [{ price: 20, status: "paid", fxRate: 58, fxTarget: "PHP" }],
      },
      {
        workspaceId,
        amount: { total: 50, deposit: 0, currency: "PHP" },
        payments: [{ price: 50, status: "paid", fxRate: null, fxTarget: null }],
      },
    ]);

    const { previewCurrencyRestatement } = await import("./currencyRestatement");
    const preview = await previewCurrencyRestatement(workspaceId);

    expect(preview).toEqual({ bookingsCount: 1 });
  });
});

describe("changeWorkspaceCurrency", () => {
  it("a workspace with no frozen money is not locked — currency changes, currencyChangedAt stays null", async () => {
    const mongoose = (await import("mongoose")).default;
    const { Workspace } = await import("@/lib/db/models");
    const workspaceId = new mongoose.Types.ObjectId();
    await Workspace.create({
      _id: workspaceId,
      slug: "empty-ws",
      name: "Empty Workspace",
      ownerUserId: "user_empty",
      currency: "PHP",
    });

    const { changeWorkspaceCurrency } = await import("./currencyRestatement");
    const result = await changeWorkspaceCurrency({
      workspaceId,
      currentCurrency: "PHP",
      currentCurrencyChangedAt: null,
      newCurrency: "SGD",
    });

    expect(result).toEqual({ ok: true, restated: false });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.currency).toBe("SGD");
    expect(ws?.currencyChangedAt ?? null).toBeNull();
  });

  it("rejects within the 90-day cooldown and writes nothing", async () => {
    const mongoose = (await import("mongoose")).default;
    const { Workspace } = await import("@/lib/db/models");
    const workspaceId = new mongoose.Types.ObjectId();
    const changedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await Workspace.create({
      _id: workspaceId,
      slug: "locked-ws",
      name: "Locked Workspace",
      ownerUserId: "user_locked",
      currency: "PHP",
      currencyChangedAt: changedAt,
    });

    const { changeWorkspaceCurrency } = await import("./currencyRestatement");
    const result = await changeWorkspaceCurrency({
      workspaceId,
      currentCurrency: "PHP",
      currentCurrencyChangedAt: changedAt,
      newCurrency: "SGD",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("currency_change_locked");
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.currency).toBe("PHP");
  });

  it("aborts wholesale when one distinct source currency's rate is unresolvable — nothing is written", async () => {
    const mongoose = (await import("mongoose")).default;
    const { Workspace, Booking } = await import("@/lib/db/models");
    const workspaceId = new mongoose.Types.ObjectId();
    await Workspace.create({
      _id: workspaceId,
      slug: "mixed-ws",
      name: "Mixed Workspace",
      ownerUserId: "user_mixed",
      currency: "PHP",
    });
    const usdBookingId = new mongoose.Types.ObjectId();
    const eurBookingId = new mongoose.Types.ObjectId();
    await Booking.collection.insertMany([
      {
        _id: usdBookingId,
        workspaceId,
        amount: { total: 100, deposit: 0, currency: "USD", fxRate: 58, fxTarget: "PHP" },
        payments: [{ price: 100, status: "paid", fxRate: 58, fxTarget: "PHP" }],
      },
      {
        _id: eurBookingId,
        workspaceId,
        amount: { total: 200, deposit: 0, currency: "EUR", fxRate: 61, fxTarget: "PHP" },
        payments: [{ price: 200, status: "paid", fxRate: 61, fxTarget: "PHP" }],
      },
    ]);
    getFxRateMock.mockImplementation(async (from: string) => (from === "USD" ? 1.35 : null));

    const { changeWorkspaceCurrency } = await import("./currencyRestatement");
    const result = await changeWorkspaceCurrency({
      workspaceId,
      currentCurrency: "PHP",
      currentCurrencyChangedAt: null,
      newCurrency: "SGD",
    });

    expect(result).toEqual({ ok: false, error: "fx_rate_unavailable" });

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.currency).toBe("PHP");
    const usdBooking = await Booking.findById(usdBookingId).lean();
    expect(usdBooking?.amount?.fxTarget).toBe("PHP");
    expect(usdBooking?.payments[0].fxTarget).toBe("PHP");
  });

  it("re-freezes from the ORIGINAL amount.currency, not the already-frozen fxTarget", async () => {
    const mongoose = (await import("mongoose")).default;
    const { Workspace, Booking, Transaction } = await import("@/lib/db/models");
    const workspaceId = new mongoose.Types.ObjectId();
    await Workspace.create({
      _id: workspaceId,
      slug: "rebase-ws",
      name: "Rebase Workspace",
      ownerUserId: "user_rebase",
      currency: "PHP",
    });
    const bookingId = new mongoose.Types.ObjectId();
    // Recorded in USD, previously frozen into PHP at 58. Changing to SGD must
    // rate USD->SGD directly — never chain PHP->SGD off the stale fxTarget.
    await Booking.collection.insertMany([
      {
        _id: bookingId,
        workspaceId,
        amount: { total: 100, deposit: 0, currency: "USD", fxRate: 58, fxTarget: "PHP" },
        payments: [{ price: 100, status: "paid", fxRate: 58, fxTarget: "PHP" }],
      },
    ]);
    await Transaction.collection.insertMany([
      {
        workspaceId,
        bookingId,
        clientId: new mongoose.Types.ObjectId(),
        amount: 100,
        currency: "USD",
        type: "balance",
        fxRate: 58,
        fxTarget: "PHP",
      },
    ]);
    getFxRateMock.mockImplementation(async (from: string, to: string) => {
      if (from === "USD" && to === "SGD") return 1.35; // correct direct rate
      if (from === "PHP" && to === "SGD") return 0.023; // must NOT be used
      return null;
    });

    const { changeWorkspaceCurrency } = await import("./currencyRestatement");
    const result = await changeWorkspaceCurrency({
      workspaceId,
      currentCurrency: "PHP",
      currentCurrencyChangedAt: null,
      newCurrency: "SGD",
    });

    expect(result).toEqual({ ok: true, restated: true });
    const booking = await Booking.findById(bookingId).lean();
    expect(booking?.amount?.fxRate).toBe(1.35);
    expect(booking?.amount?.fxTarget).toBe("SGD");
    expect(booking?.payments[0].fxRate).toBe(1.35);
    expect(booking?.payments[0].fxTarget).toBe("SGD");
    const tx = await Transaction.findOne({ bookingId }).lean();
    expect(tx?.fxRate).toBe(1.35);
    expect(tx?.fxTarget).toBe("SGD");
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.currency).toBe("SGD");
    expect(ws?.currencyChangedAt).toBeInstanceOf(Date);
  });

  it("tenant isolation — a frozen booking in a different workspace is not restated", async () => {
    const mongoose = (await import("mongoose")).default;
    const { Workspace, Booking } = await import("@/lib/db/models");
    const workspaceId = new mongoose.Types.ObjectId();
    const otherWorkspaceId = new mongoose.Types.ObjectId();
    await Workspace.create([
      {
        _id: workspaceId,
        slug: "tenant-a",
        name: "Tenant A",
        ownerUserId: "user_a",
        currency: "PHP",
      },
      {
        _id: otherWorkspaceId,
        slug: "tenant-b",
        name: "Tenant B",
        ownerUserId: "user_b",
        currency: "PHP",
      },
    ]);
    const bookingId = new mongoose.Types.ObjectId();
    const otherBookingId = new mongoose.Types.ObjectId();
    await Booking.collection.insertMany([
      {
        _id: bookingId,
        workspaceId,
        amount: { total: 100, deposit: 0, currency: "USD", fxRate: 58, fxTarget: "PHP" },
        payments: [{ price: 100, status: "paid", fxRate: 58, fxTarget: "PHP" }],
      },
      {
        _id: otherBookingId,
        workspaceId: otherWorkspaceId,
        amount: { total: 100, deposit: 0, currency: "USD", fxRate: 58, fxTarget: "PHP" },
        payments: [{ price: 100, status: "paid", fxRate: 58, fxTarget: "PHP" }],
      },
    ]);
    getFxRateMock.mockImplementation(async () => 1.35);

    const { changeWorkspaceCurrency } = await import("./currencyRestatement");
    await changeWorkspaceCurrency({
      workspaceId,
      currentCurrency: "PHP",
      currentCurrencyChangedAt: null,
      newCurrency: "SGD",
    });

    const otherBooking = await Booking.findById(otherBookingId).lean();
    expect(otherBooking?.amount?.fxTarget).toBe("PHP");
    expect(otherBooking?.payments[0].fxTarget).toBe("PHP");
    const otherWs = await Workspace.findById(otherWorkspaceId).lean();
    expect(otherWs?.currency).toBe("PHP");
  });
});
