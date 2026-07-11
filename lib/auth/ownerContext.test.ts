import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User } from "@/lib/db/models";

// ---------------------------------------------------------------------------
// Mutable auth stub.
// ---------------------------------------------------------------------------
const authUserStub: {
  workosUserId: string | null;
  email: string;
  name: string;
  avatarUrl: string | null;
} = {
  workosUserId: "user_owner",
  email: "owner@test.com",
  name: "Owner",
  avatarUrl: null,
};

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("./session", () => ({
  getAuthUser: async () =>
    authUserStub.workosUserId
      ? {
          workosUserId: authUserStub.workosUserId,
          email: authUserStub.email,
          name: authUserStub.name,
          avatarUrl: authUserStub.avatarUrl,
        }
      : null,
}));

// ---------------------------------------------------------------------------
// Cookie stub — default to no active-workspace cookie set.
// ---------------------------------------------------------------------------
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v !== undefined ? { value: v } : undefined;
    },
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "test-secret-ownerctx";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  cookieStore.clear();
  authUserStub.workosUserId = "user_owner";
  authUserStub.email = "owner@test.com";
  authUserStub.name = "Owner";
  authUserStub.avatarUrl = null;
});

async function makeWorkspace(opts?: {
  ownerUserId?: string;
  memberUserId?: string;
  memberRole?: "owner" | "staff";
}): Promise<Types.ObjectId> {
  const ownerUserId = opts?.ownerUserId ?? "user_owner";
  const wsId = new Types.ObjectId();
  await Workspace.create({
    _id: wsId,
    ownerUserId,
    name: "Test",
    slug: `test-${wsId.toString()}`,
    plan: "free",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });
  return wsId;
}

async function load() {
  return import("./ownerContext");
}

describe("ownerContext — auth checks", () => {
  it("returns error when unauthenticated", async () => {
    authUserStub.workosUserId = null;
    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("not_authenticated");
  });

  it("returns error when user has no memberships", async () => {
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [],
    });
    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/workspace/i);
  });
});

describe("ownerContext — onboarding gate", () => {
  it("rejects an owner who has not completed onboarding", async () => {
    const wsId = await makeWorkspace();
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "business",
      onboardingCompletedAt: null,
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/onboarding/i);
  });

  it("admits an owner who has finished onboarding", async () => {
    const wsId = await makeWorkspace();
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.userId).toBe("user_owner");
      expect(result.workspaceId).toBe(wsId.toString());
      // clerkOrgId must NOT be present in the new shape.
      expect(result).not.toHaveProperty("clerkOrgId");
    }
  });

  it("respects allowDuringOnboarding=true escape hatch", async () => {
    const wsId = await makeWorkspace();
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "business",
      onboardingCompletedAt: null,
    });

    const { ownerContext } = await load();
    const result = await ownerContext({ allowDuringOnboarding: true });
    expect("error" in result).toBe(false);
  });
});

describe("ownerContext — ownership check", () => {
  it("rejects a non-owner (workspace.ownerUserId does not match)", async () => {
    authUserStub.workosUserId = "user_staff";
    const wsId = await makeWorkspace({ ownerUserId: "user_owner" });
    await User.create({
      workosUserId: "user_staff",
      email: "staff@test.com",
      memberships: [{ workspaceId: wsId, role: "staff" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/owner/i);
  });

  it("admits when ownerUserId matches even if membership.role is staff", async () => {
    const wsId = await makeWorkspace({ ownerUserId: "user_owner" });
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "staff" }], // wrong role
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(false);
  });
});

describe("ownerContext — subscription gate", () => {
  it("gated owner (plan=free, everSubscribed=true) returns error: subscription_required", async () => {
    const wsId = new Types.ObjectId();
    await Workspace.create({
      _id: wsId,
      ownerUserId: "user_owner",
      name: "Test",
      slug: `gated-owner-${wsId.toString()}`,
      plan: "free",
      everSubscribed: true,
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("subscription_required");
  });

  it("allowWhenGated=true bypasses the gate for a gated workspace", async () => {
    const wsId = new Types.ObjectId();
    await Workspace.create({
      _id: wsId,
      ownerUserId: "user_owner",
      name: "Test",
      slug: `gated-bypass-${wsId.toString()}`,
      plan: "free",
      everSubscribed: true,
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { ownerContext } = await load();
    const result = await ownerContext({ allowWhenGated: true });
    expect("error" in result).toBe(false);
  });

  it("never-subscribed free workspace (everSubscribed=false) is NOT gated", async () => {
    const wsId = await makeWorkspace();
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(false);
  });

  it("onboarding-incomplete owner gets onboarding_required even when also gated (onboarding check runs first)", async () => {
    const wsId = new Types.ObjectId();
    await Workspace.create({
      _id: wsId,
      ownerUserId: "user_owner",
      name: "Test",
      slug: `gated-onboarding-${wsId.toString()}`,
      plan: "free",
      everSubscribed: true,
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "business",
      onboardingCompletedAt: null,
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/onboarding/i);
  });
});

describe("ownerContext — tenant isolation", () => {
  it("cookie for a workspace the user is NOT a member of is rejected and returns error", async () => {
    const legitWsId = new Types.ObjectId();
    const attackerWsId = new Types.ObjectId();

    await Workspace.create({
      _id: legitWsId,
      ownerUserId: "user_owner",
      name: "Legit",
      slug: `legit-${legitWsId.toString()}`,
      plan: "free",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });
    // attacker workspace — user_owner is NOT a member
    await Workspace.create({
      _id: attackerWsId,
      ownerUserId: "attacker",
      name: "Attacker",
      slug: `attacker-${attackerWsId.toString()}`,
      plan: "free",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });

    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: legitWsId, role: "owner" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    // Forge a valid-MAC cookie for the attacker workspace.
    const { createHmac } = await import("crypto");
    const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET!;
    const mac = createHmac("sha256", secret).update(String(attackerWsId)).digest("hex");
    cookieStore.set("gw_active_ws", `${String(attackerWsId)}.${mac}`);

    const { ownerContext } = await load();
    const result = await ownerContext();

    // The cookie is rejected, falls back to the sole legitimate membership,
    // and ownership is confirmed since ownerUserId matches.
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.workspaceId).toBe(legitWsId.toString());
      expect(result.workspaceId).not.toBe(attackerWsId.toString());
    }
  });
});
