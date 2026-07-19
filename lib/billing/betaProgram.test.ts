import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { closeBetaProgram, scheduleBetaProgramEnd, shouldShowBetaEndingWarning } from "./betaProgram";
import { BetaProgram } from "@/lib/db/models";

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

describe("beta end announcement", () => {
  it("shows only during the final week and until beta closes", () => {
    const now = new Date("2026-07-17T00:00:00.000Z");
    expect(shouldShowBetaEndingWarning(new Date("2026-07-24T00:00:00.000Z"), null, now)).toBe(true);
    expect(shouldShowBetaEndingWarning(new Date("2026-07-25T00:00:00.000Z"), null, now)).toBe(false);
    expect(shouldShowBetaEndingWarning(new Date("2026-07-24T00:00:00.000Z"), new Date(), now)).toBe(false);
  });

  it("stores an operator-set future beta end date without closing the program", async () => {
    const scheduledEndAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await scheduleBetaProgramEnd(scheduledEndAt, "wos_operator");

    const program = await BetaProgram.findOne({}).lean();
    expect(program?.scheduledEndAt?.getTime()).toBe(scheduledEndAt.getTime());
    expect(program?.scheduledByUserId).toBe("wos_operator");
    expect(program?.closedAt).toBeNull();
  });

  it("refuses to schedule a beta program that is already closed", async () => {
    await closeBetaProgram("wos_operator");
    await expect(
      scheduleBetaProgramEnd(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "wos_operator")
    ).rejects.toThrow(/already closed/i);
  });
});
