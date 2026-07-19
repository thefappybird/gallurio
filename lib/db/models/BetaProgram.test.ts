import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { BetaProgram } from "./BetaProgram";
import { isBetaProgramClosed, closeBetaProgram } from "@/lib/billing/betaProgram";
import { Workspace } from "@/lib/db/models";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

describe("BetaProgram model defaults", () => {
  it("defaults startedAt, closedAt, closedByUserId to null", async () => {
    const doc = await BetaProgram.create({});
    expect(doc.startedAt).toBeNull();
    expect(doc.closedAt).toBeNull();
    expect(doc.closedByUserId).toBeNull();
  });
});

describe("isBetaProgramClosed", () => {
  it("returns false when no BetaProgram document exists", async () => {
    expect(await isBetaProgramClosed()).toBe(false);
  });
});

function makeWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    slug: `ws-${Math.random().toString(36).slice(2)}`,
    name: "Test Studio",
    ownerUserId: `user_${Math.random().toString(36).slice(2)}`,
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    plan: "beta",
    ...overrides,
  };
}

describe("closeBetaProgram — first call", () => {
  it("sets closedAt/closedByUserId and flips plan:beta workspaces to free with lifecycle.lapsedAt stamped", async () => {
    const betaWs = await Workspace.create(makeWorkspace({ plan: "beta" }));
    const proWs = await Workspace.create(makeWorkspace({ plan: "pro" }));
    const freeWs = await Workspace.create(makeWorkspace({ plan: "free" }));

    const result = await closeBetaProgram("workos_operator_1");
    expect(result.alreadyClosed).toBe(false);

    const program = await BetaProgram.findOne({}).lean();
    expect(program?.closedAt).not.toBeNull();
    expect(program?.closedByUserId).toBe("workos_operator_1");

    const flipped = await Workspace.findById(betaWs._id).lean();
    expect(flipped?.plan).toBe("free");
    expect(flipped?.lifecycle?.lapsedAt).not.toBeNull();

    const untouchedPro = await Workspace.findById(proWs._id).lean();
    expect(untouchedPro?.plan).toBe("pro");
    expect(untouchedPro?.lifecycle?.lapsedAt).toBeNull();

    const untouchedFree = await Workspace.findById(freeWs._id).lean();
    expect(untouchedFree?.plan).toBe("free");
    expect(untouchedFree?.lifecycle?.lapsedAt).toBeNull();
  });
});

describe("closeBetaProgram — idempotent second call", () => {
  it("returns alreadyClosed:true and does not re-stamp lifecycle.lapsedAt on already-flipped workspaces", async () => {
    const betaWs = await Workspace.create(makeWorkspace({ plan: "beta" }));

    await closeBetaProgram("workos_operator_1");
    const flippedOnce = await Workspace.findById(betaWs._id).lean();
    const firstLapsedAt = flippedOnce?.lifecycle?.lapsedAt;
    expect(firstLapsedAt).not.toBeNull();

    const secondResult = await closeBetaProgram("workos_operator_2");
    expect(secondResult.alreadyClosed).toBe(true);

    const program = await BetaProgram.findOne({}).lean();
    expect(program?.closedByUserId).toBe("workos_operator_1");

    const flippedTwice = await Workspace.findById(betaWs._id).lean();
    expect(flippedTwice?.plan).toBe("free");
    expect(flippedTwice?.lifecycle?.lapsedAt?.getTime()).toBe(firstLapsedAt?.getTime());
  });
});
