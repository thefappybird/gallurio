import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { expireGrantIfPast } from "./checkGrantExpiry";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

describe("expireGrantIfPast", () => {
  it("stamps lifecycle.lapsedAt when it expires a grant and lapsedAt was null", async () => {
    const ws = await Workspace.create({
      slug: "grant-expiry-ws",
      name: "Grant Expiry WS",
      ownerUserId: "wos_grant_expiry",
      plan: "beta",
      planGrantExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    await expireGrantIfPast(ws);

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lifecycle?.lapsedAt).toBeInstanceOf(Date);
  });
});
