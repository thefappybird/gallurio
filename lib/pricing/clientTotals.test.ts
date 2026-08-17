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
    const totals = await getConvertedClientTotals(workspaceId, [clientA], { PHP: 1 });

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
      PHP: 1,
      USD: 58,
    });

    expect(totals?.get(String(clientA))).toBe(5_000 + 100 * 58);
    expect(totals?.get(String(clientB))).toBe(20 * 58);
  });
});
