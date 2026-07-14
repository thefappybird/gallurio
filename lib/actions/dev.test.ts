import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { User, Workspace, BetaProgram } from "@/lib/db/models";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";

// ---------------------------------------------------------------------------
// Module mocks — declared before importing the tested module.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth/activeWorkspace", () => ({
  getActiveWorkspaceId: vi.fn(),
  clearActiveWorkspace: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getAuthUser } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/auth/activeWorkspace";
import { devActivatePlanAction } from "./dev";

const mockGetAuthUser = getAuthUser as MockedFunction<typeof getAuthUser>;
const mockGetActiveWorkspaceId =
  getActiveWorkspaceId as MockedFunction<typeof getActiveWorkspaceId>;

const WOS_ID = "wos_dev_user";

async function seedOwner() {
  const ws = await Workspace.create({
    slug: "dev-ws",
    name: "Dev Workspace",
    ownerUserId: WOS_ID,
    plan: "free",
  });
  await User.create({
    workosUserId: WOS_ID,
    email: "dev@example.com",
    name: "Dev User",
    memberships: [
      { workspaceId: ws._id, role: "owner", lastAccessedAt: new Date() },
    ],
    onboardingStep: "plan",
  });
  mockGetAuthUser.mockResolvedValue({
    workosUserId: WOS_ID,
    email: "dev@example.com",
    name: "Dev User",
    avatarUrl: null,
  } as never);
  mockGetActiveWorkspaceId.mockResolvedValue(ws._id.toString());
  return ws;
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
});

describe("devActivatePlanAction", () => {
  it("simulates a complete active subscription for a paid plan", async () => {
    const ws = await seedOwner();

    const result = await devActivatePlanAction("pro");
    expect(result.ok).toBe(true);

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("pro");
    expect(updated?.lsSubscriptionStatus).toBe("active");
    expect(updated?.lsCurrentPeriodEnd).toBeTruthy();
    // IDs are populated so billing-dependent surfaces behave like a real sub.
    expect(updated?.lsSubscriptionId).toBe(`dev_sub_${ws._id}`);
    expect(updated?.lsCustomerId).toBe(`dev_cus_${ws._id}`);

    // Onboarding is advanced so the flow can complete without Lemon Squeezy.
    const user = await User.findOne({ workosUserId: WOS_ID }).lean();
    expect(user?.onboardingStep).toBe("done");
  });

  it("clears subscription fields when downgrading to free", async () => {
    const ws = await seedOwner();
    await Workspace.updateOne(
      { _id: ws._id },
      {
        $set: {
          plan: "pro",
          lsSubscriptionStatus: "active",
          lsSubscriptionId: "dev_sub_x",
          lsCustomerId: "dev_cus_x",
          lsCurrentPeriodEnd: new Date(),
        },
      },
    );

    const result = await devActivatePlanAction("free");
    expect(result.ok).toBe(true);

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("free");
    expect(updated?.lsSubscriptionStatus).toBeNull();
    expect(updated?.lsSubscriptionId).toBeNull();
    expect(updated?.lsCustomerId).toBeNull();
    expect(updated?.lsCurrentPeriodEnd).toBeNull();
  });

  it("grants beta without touching any ls* field", async () => {
    const ws = await seedOwner();

    const result = await devActivatePlanAction("beta");
    expect(result.ok).toBe(true);

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("beta");
    expect(updated?.planGrantExpiresAt).toBeNull();
    expect(updated?.lsSubscriptionStatus).toBeNull();
    expect(updated?.lsSubscriptionId).toBeNull();
    expect(updated?.lsCustomerId).toBeNull();
    expect(updated?.lsCurrentPeriodEnd).toBeNull();
  });

  it("refuses to grant beta when the global beta program is closed", async () => {
    const ws = await seedOwner();
    await BetaProgram.create({ closedAt: new Date(), closedByUserId: "wos_operator" });

    const result = await devActivatePlanAction("beta");
    expect(result.error).toBe("beta_program_closed");

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("free");
  });

  it("respects the team-cap downgrade guard when switching to beta", async () => {
    const ws = await seedOwner();
    for (let i = 0; i < 20; i++) {
      await Team.create({
        workspaceId: ws._id,
        name: `Team ${i + 1}`,
        color: TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length],
        isDefault: i === 0,
        memberCount: 0,
        createdByWorkosUserId: WOS_ID,
      });
    }

    const result = await devActivatePlanAction("beta");
    expect(result.error).toBe("TEAM_DOWNGRADE_BLOCKED");
    expect(result.blocked?.currentTeamCount).toBe(20);
    expect(result.blocked?.maxTeamsOnTargetPlan).toBe(15);

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("free");
  });

  it("is blocked in production", async () => {
    const prev = process.env.NODE_ENV;
    // @ts-expect-error — NODE_ENV is read-only in the types but writable at runtime
    process.env.NODE_ENV = "production";
    try {
      const result = await devActivatePlanAction("pro");
      expect(result.error).toBe("Not available in production");
    } finally {
      // @ts-expect-error — restore
      process.env.NODE_ENV = prev;
    }
  });

  it("returns an error when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await devActivatePlanAction("pro");
    expect(result.error).toBeTruthy();
  });
});
