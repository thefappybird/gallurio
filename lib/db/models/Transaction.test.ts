import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Transaction } from "@/lib/db/models";
import { Types } from "mongoose";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

function baseTransaction(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: new Types.ObjectId(),
    amount: 100,
    type: "balance" as const,
    ...overrides,
  };
}

describe("Transaction model — fx fields", () => {
  it("defaults fxRate, fxTarget, and fxAt to null when omitted", async () => {
    const t = await Transaction.create(baseTransaction());
    expect(t.fxRate).toBeNull();
    expect(t.fxTarget).toBeNull();
    expect(t.fxAt).toBeNull();
  });
});
