import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { closeBetaProgram } from "./betaProgram";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

describe("closeBetaProgram", () => {
  it("flips a plain beta-plan workspace (no pending grant) to free and stamps lifecycle.lapsedAt", async () => {
    const ws = await Workspace.create({
      slug: "beta-close-ws",
      name: "Beta Close WS",
      ownerUserId: "wos_beta_owner",
      plan: "beta",
    });

    await closeBetaProgram("wos_admin");

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lifecycle?.lapsedAt).toBeInstanceOf(Date);
  });

  it("applies a queued grant on a beta-plan workspace instead of flipping it to gated free", async () => {
    const ws = await Workspace.create({
      slug: "beta-close-pending-ws",
      name: "Beta Close Pending WS",
      ownerUserId: "wos_beta_pending_owner",
      plan: "beta",
      pendingPromoGrant: { grantMonths: 2, queuedAt: new Date() },
    });

    await closeBetaProgram("wos_admin");

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.planGrantExpiresAt).toBeInstanceOf(Date);
    expect(after?.pendingPromoGrant?.grantMonths).toBeNull();
  });
});
