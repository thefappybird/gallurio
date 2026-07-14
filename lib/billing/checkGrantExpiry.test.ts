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

  it("applies a queued promo grant instead of flipping to free, and mutates the passed-in object", async () => {
    const ws = await Workspace.create({
      slug: "grant-expiry-pending-ws",
      name: "Grant Expiry Pending WS",
      ownerUserId: "wos_grant_expiry_pending",
      plan: "beta",
      planGrantExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      pendingPromoGrant: { grantMonths: 2, queuedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const result = await expireGrantIfPast(ws);

    expect(result.plan).toBe("pro");
    expect(result.planGrantExpiresAt).toBeInstanceOf(Date);
    expect(result.planGrantExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.plan).not.toBe("free");
    expect(after?.planGrantExpiresAt).toBeInstanceOf(Date);
    expect(after?.pendingPromoGrant?.grantMonths).toBeNull();
  });
});
