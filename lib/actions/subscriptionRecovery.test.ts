import { afterAll, afterEach, beforeAll, describe, expect, it, vi, type MockedFunction } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User, Workspace } from "@/lib/db/models";

vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth/activeWorkspace", () => ({ getActiveWorkspaceId: vi.fn() }));

import { getAuthUser } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/auth/activeWorkspace";
import { activateBetaRecoveryAction } from "./subscriptionRecovery";

const WOS_ID = "wos_recovery_owner";
const mockGetAuthUser = getAuthUser as MockedFunction<typeof getAuthUser>;
const mockGetActiveWorkspaceId = getActiveWorkspaceId as MockedFunction<typeof getActiveWorkspaceId>;
const originalBetaFlag = process.env.BETA_TESTER_ENABLED;

async function seedLapsedOwner(overrides: Record<string, unknown> = {}) {
  const workspace = await Workspace.create({
    slug: "recovery-ws",
    name: "Recovery Workspace",
    ownerUserId: WOS_ID,
    plan: "free",
    ...overrides,
  });
  await User.create({
    workosUserId: WOS_ID,
    email: "recovery@example.com",
    memberships: [{ workspaceId: workspace._id, role: "owner", lastAccessedAt: new Date() }],
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
  });
  mockGetAuthUser.mockResolvedValue({
    workosUserId: WOS_ID,
    email: "recovery@example.com",
    name: "Recovery Owner",
    avatarUrl: null,
  } as never);
  mockGetActiveWorkspaceId.mockResolvedValue(String(workspace._id));
  return workspace;
}

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => {
  if (originalBetaFlag === undefined) delete process.env.BETA_TESTER_ENABLED;
  else process.env.BETA_TESTER_ENABLED = originalBetaFlag;
  await stopInMemoryMongo();
});
afterEach(async () => {
  delete process.env.BETA_TESTER_ENABLED;
  await clearCollections();
  vi.clearAllMocks();
});

describe("activateBetaRecoveryAction", () => {
  it("grants a lapsed owner beta and records the one-time recovery marker", async () => {
    process.env.BETA_TESTER_ENABLED = "true";
    const workspace = await seedLapsedOwner({ everSubscribed: true });

    await expect(activateBetaRecoveryAction()).resolves.toEqual({ ok: true });

    const [updatedWorkspace, updatedUser] = await Promise.all([
      Workspace.findById(workspace._id).lean(),
      User.findOne({ workosUserId: WOS_ID }).lean(),
    ]);
    expect(updatedWorkspace?.plan).toBe("beta");
    expect(updatedWorkspace?.planGrantExpiresAt).toBeNull();
    expect(updatedUser?.betaParticipation?.recordedAt).toBeInstanceOf(Date);
    expect(updatedUser?.betaParticipation?.source).toBe("recovery");
  });

  it("does not activate beta a second time for the same identity", async () => {
    process.env.BETA_TESTER_ENABLED = "true";
    const workspace = await seedLapsedOwner({ everSubscribed: true });
    await User.updateOne(
      { workosUserId: WOS_ID },
      { $set: { "betaParticipation.recordedAt": new Date(), "betaParticipation.source": "onboarding" } },
    );

    await expect(activateBetaRecoveryAction()).resolves.toEqual({ error: "beta_already_activated" });

    const unchanged = await Workspace.findById(workspace._id).lean();
    expect(unchanged?.plan).toBe("free");
  });

  it("does not grant beta when the workspace is already entitled", async () => {
    process.env.BETA_TESTER_ENABLED = "true";
    await seedLapsedOwner({ plan: "pro", planGrantExpiresAt: new Date(Date.now() + 86_400_000) });

    await expect(activateBetaRecoveryAction()).resolves.toEqual({ error: "subscription_not_gated" });
  });
});
