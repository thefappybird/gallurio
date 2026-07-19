import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { PromoCode, Workspace } from "@/lib/db/models";
import { isEntitled } from "./access";
import { revokePromoCode, revokeWorkspacePromoGrant } from "./promoRevocation";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

describe("revokePromoCode", () => {
  it("sets revokedAt on the code", async () => {
    const promo = await PromoCode.create({
      title: "revoke me",
      code: "revokeme1",
      type: "lifetime",
    });

    await revokePromoCode(String(promo._id), "wos_admin");

    const updated = await PromoCode.findById(promo._id).lean();
    expect(updated?.revokedAt).toBeInstanceOf(Date);
  });

  it("is idempotent — a second revoke keeps the original revokedAt timestamp", async () => {
    const promo = await PromoCode.create({
      title: "revoke twice",
      code: "revoketwice1",
      type: "lifetime",
    });

    await revokePromoCode(String(promo._id), "wos_admin");
    const firstRevokedAt = (await PromoCode.findById(promo._id).lean())?.revokedAt?.getTime();

    await revokePromoCode(String(promo._id), "wos_admin");
    const secondRevokedAt = (await PromoCode.findById(promo._id).lean())?.revokedAt?.getTime();

    expect(secondRevokedAt).toBe(firstRevokedAt);
  });
});

describe("revokeWorkspacePromoGrant", () => {
  it("clears an applied grant so the workspace reads as gated per isEntitled()", async () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 2);
    const ws = await Workspace.create({
      slug: "revoke-grant-ws",
      name: "Revoke Grant WS",
      ownerUserId: "wos_grant_owner",
      plan: "pro",
      planGrantExpiresAt: future,
    });

    await revokeWorkspacePromoGrant(String(ws._id), "wos_admin");

    const updated = await Workspace.findById(ws._id).lean();
    expect(isEntitled(updated!)).toBe(false);
  });
});
