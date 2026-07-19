import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { getNextInvoiceSeq, formatInvoiceNumber } from "./counter";

const workspaceId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

describe("getNextInvoiceSeq", () => {
  it("20 concurrent calls for the same workspace yield 20 distinct sequential values", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => getNextInvoiceSeq(workspaceId))
    );
    const unique = new Set(results);
    expect(unique.size).toBe(20);
    expect([...unique].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("a second workspace's counter is independent and starts at 1", async () => {
    await getNextInvoiceSeq(workspaceId);
    await getNextInvoiceSeq(workspaceId);
    const otherWorkspaceId = new Types.ObjectId();
    const seq = await getNextInvoiceSeq(otherWorkspaceId);
    expect(seq).toBe(1);
  });

  it("rejects a raw duplicate {workspaceId,key} insert (proves the unique index)", async () => {
    const { Counter } = await import("@/lib/db/models");
    await Counter.create({ workspaceId, key: "invoice", seq: 1 });
    await expect(Counter.create({ workspaceId, key: "invoice", seq: 1 })).rejects.toMatchObject({
      code: 11000,
    });
  });
});

describe("formatInvoiceNumber", () => {
  it("pads the sequence to 6 digits with an INV- prefix", () => {
    expect(formatInvoiceNumber(7)).toBe("INV-000007");
  });
});
