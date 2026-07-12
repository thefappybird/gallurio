import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Client } from "@/lib/db/models";
import { getTopClients } from "./dashboard-metrics";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

describe("getTopClients", () => {
  it("returns only _id, name, and totalSpent (projected, not the full Client doc)", async () => {
    const ws = new Types.ObjectId();
    await Client.create({
      workspaceId: ws,
      name: "Studio Aurora",
      email: "studio@example.com",
      totalSpent: 5000,
      transactions: [
        {
          bookingId: new Types.ObjectId(),
          amount: 5000,
          type: "deposit",
          occurredAt: new Date(),
          source: "manual",
        },
      ],
    });

    const [top] = await getTopClients(ws, 5);

    expect(top.name).toBe("Studio Aurora");
    expect(top.totalSpent).toBe(5000);
    expect((top as Record<string, unknown>).email).toBeUndefined();
    expect((top as Record<string, unknown>).transactions).toBeUndefined();
  });
});
