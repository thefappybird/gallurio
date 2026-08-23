/**
 * getConvertedClientTotals recomputes Client.totalSpent in the workspace
 * currency from the Transaction ledger. The stored field is a raw running sum
 * in whatever currency each booking used, so it is only meaningful as-is for a
 * single-currency workspace.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Transaction } from "@/lib/db/models";
import { getConvertedClientTotals } from "./clientTotals";

const workspaceId = new Types.ObjectId();
const clientA = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

describe("getConvertedClientTotals", () => {
  it("returns null for a single-currency workspace so callers keep the stored total", async () => {
    const totals = await getConvertedClientTotals(workspaceId, [clientA], {
      rates: { PHP: 1 },
      target: "PHP",
    });

    expect(totals).toBeNull();
  });

  it("sums each client's deposits and balances in the workspace currency", async () => {
    const clientB = new Types.ObjectId();
    await Transaction.create([
      { workspaceId, clientId: clientA, amount: 5_000, currency: "PHP", type: "deposit" },
      { workspaceId, clientId: clientA, amount: 100, currency: "USD", type: "balance" },
      // Refunds and subscription rows are outside totalSpent's definition.
      { workspaceId, clientId: clientA, amount: -50, currency: "USD", type: "refund" },
      { workspaceId, clientId: clientB, amount: 20, currency: "USD", type: "deposit" },
    ]);

    const totals = await getConvertedClientTotals(workspaceId, [clientA, clientB], {
      rates: { PHP: 1, USD: 58 },
      target: "PHP",
    });

    expect(totals?.get(String(clientA))).toBe(5_000 + 100 * 58);
    expect(totals?.get(String(clientB))).toBe(20 * 58);
  });

  it("sums a payment at its frozen rate, not today's live rate", async () => {
    await Transaction.create([
      {
        workspaceId,
        clientId: clientA,
        amount: 10,
        currency: "USD",
        type: "deposit",
        fxRate: 55,
        fxTarget: "PHP",
      },
    ]);

    const totals = await getConvertedClientTotals(workspaceId, [clientA], {
      rates: { PHP: 1, USD: 58 },
      target: "PHP",
    });

    expect(totals?.get(String(clientA))).toBe(10 * 55);
  });

  it("falls back to the live rate when the frozen fxTarget doesn't match the current workspace currency", async () => {
    await Transaction.create([
      {
        workspaceId,
        clientId: clientA,
        amount: 10,
        currency: "USD",
        type: "deposit",
        fxRate: 50,
        fxTarget: "EUR", // stale — workspace currency was restated away from EUR
      },
    ]);

    const totals = await getConvertedClientTotals(workspaceId, [clientA], {
      rates: { PHP: 1, USD: 58 },
      target: "PHP",
    });

    expect(totals?.get(String(clientA))).toBe(10 * 58);
  });

  it("converts an unfrozen legacy payment (no fxRate) the same as before frozen rates existed", async () => {
    await Transaction.create([
      { workspaceId, clientId: clientA, amount: 10, currency: "USD", type: "deposit" },
    ]);

    const totals = await getConvertedClientTotals(workspaceId, [clientA], {
      rates: { PHP: 1, USD: 58 },
      target: "PHP",
    });

    expect(totals?.get(String(clientA))).toBe(10 * 58);
  });

  it("never returns another workspace's client spend", async () => {
    const otherWorkspaceId = new Types.ObjectId();
    const clientOfOtherWorkspace = new Types.ObjectId();
    await Transaction.create([
      {
        workspaceId: otherWorkspaceId,
        clientId: clientOfOtherWorkspace,
        amount: 999_999,
        currency: "USD",
        type: "deposit",
      },
    ]);

    const totals = await getConvertedClientTotals(workspaceId, [clientOfOtherWorkspace], {
      rates: { PHP: 1, USD: 58 },
      target: "PHP",
    });

    expect(totals?.get(String(clientOfOtherWorkspace))).toBeUndefined();
    expect(totals?.size).toBe(0);
  });
});
