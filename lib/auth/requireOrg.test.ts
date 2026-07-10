import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User } from "@/lib/db/models";

// ---------------------------------------------------------------------------
// Mutable auth stub — tests mutate this to simulate different users.
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

// next-intl locale fixed to "en" so localized() returns bare paths.
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
}));

// Capture redirect calls without actually throwing.
const redirectMock = vi.fn((_url: string): never => {
  throw new Error(`REDIRECT:${_url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
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

process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "test-secret-requireorg";

// ---------------------------------------------------------------------------
// In-memory Mongo lifecycle
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  cookieStore.clear();
  redirectMock.mockClear();
  // Reset to default owner stub.
  authUserStub.workosUserId = "user_owner";
  authUserStub.email = "owner@test.com";
  authUserStub.name = "Owner";
  authUserStub.avatarUrl = null;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function makeWorkspaceWithOwner(opts?: {
  ownerWorkosUserId?: string;
  memberWorkosUserId?: string;
  memberRole?: "owner" | "staff";
  onboardingCompletedAt?: Date | null;
}): Promise<{ wsId: Types.ObjectId }> {
  const ownerWorkosUserId = opts?.ownerWorkosUserId ?? "user_owner";
  const wsId = new Types.ObjectId();

  await Workspace.create({
    _id: wsId,
    ownerUserId: ownerWorkosUserId,
    name: "Test Workspace",
    slug: `test-ws-${wsId.toString()}`,
    plan: "free",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });

  const userWorkosUserId = opts?.memberWorkosUserId ?? ownerWorkosUserId;
  await User.create({
    workosUserId: userWorkosUserId,
    email: `${userWorkosUserId}@test.com`,
    memberships: [{ workspaceId: wsId, role: opts?.memberRole ?? "owner" }],
    onboardingStep: "done",
    onboardingCompletedAt:
      opts?.onboardingCompletedAt !== undefined
        ? opts.onboardingCompletedAt
        : new Date(),
  });

  return { wsId };
}

async function load() {
  // Dynamic import so vi.mock() hoisting has settled.
  return import("./requireOrg");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("requireOrg — auth and workspace resolution", () => {
  it("unauthenticated user redirects to /sign-in", async () => {
    authUserStub.workosUserId = null;
    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/sign-in");
    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });

  it("user with no memberships redirects to /onboarding", async () => {
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [],
    });
    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("owner with completed onboarding returns role=owner and workspaceId", async () => {
    const { wsId } = await makeWorkspaceWithOwner();
    const { requireOrg } = await load();
    const ctx = await requireOrg();

    expect(ctx.role).toBe("owner");
    expect(ctx.userId).toBe("user_owner");
    expect(ctx.workspaceId).toBe(wsId.toString());
    // clerkOrgId must NOT be present in the new shape.
    expect(ctx).not.toHaveProperty("clerkOrgId");
  });

  it("owner with onboardingCompletedAt=null IS redirected to /onboarding", async () => {
    await makeWorkspaceWithOwner({ onboardingCompletedAt: null });
    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("allowDuringOnboarding=true lets owner through without onboardingCompletedAt", async () => {
    await makeWorkspaceWithOwner({ onboardingCompletedAt: null });
    const { requireOrg } = await load();
    const ctx = await requireOrg({ allowDuringOnboarding: true });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.role).toBe("owner");
  });

  it("staff member with membership.role=staff is NOT redirected and gets role=staff", async () => {
    authUserStub.workosUserId = "user_staff";
    const { wsId } = await makeWorkspaceWithOwner({
      memberWorkosUserId: "user_staff",
      memberRole: "staff",
      onboardingCompletedAt: null, // staff never complete onboarding
    });
    const { requireOrg } = await load();
    const ctx = await requireOrg();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.role).toBe("staff");
    expect(ctx.userId).toBe("user_staff");
    expect(ctx.workspaceId).toBe(wsId.toString());
  });

  it("ownerUserId match overrides membership.role — DB truth wins", async () => {
    // User has membership.role=staff BUT workspace.ownerUserId matches workosUserId.
    const wsId = new Types.ObjectId();
    await Workspace.create({
      _id: wsId,
      ownerUserId: "user_owner",
      name: "Test",
      slug: `test-ownerid-${wsId.toString()}`,
      plan: "free",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "staff" }], // wrong role in membership
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { requireOrg } = await load();
    const ctx = await requireOrg();

    expect(ctx.role).toBe("owner");
  });

  it("missing workspace (deleted) redirects to /onboarding", async () => {
    // User has a membership pointing at a non-existent workspace.
    const wsId = new Types.ObjectId();
    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: wsId, role: "owner" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });
});

describe("requireOrg — tenant isolation", () => {
  it("cookie pointing at a workspace the user is NOT a member of is rejected", async () => {
    // Create two workspaces; user is a member of ws1 only.
    const ws1 = new Types.ObjectId();
    const ws2 = new Types.ObjectId();

    await Workspace.create({
      _id: ws1,
      ownerUserId: "user_owner",
      name: "WS1",
      slug: `ws1-${ws1.toString()}`,
      plan: "free",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });
    await Workspace.create({
      _id: ws2,
      ownerUserId: "other_owner",
      name: "WS2",
      slug: `ws2-${ws2.toString()}`,
      plan: "free",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });

    await User.create({
      workosUserId: "user_owner",
      email: "owner@test.com",
      memberships: [{ workspaceId: ws1, role: "owner" }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
    });

    // Forge a correctly-signed cookie for ws2 (user is not a member of ws2).
    const { createHmac } = await import("crypto");
    const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET!;
    const mac = createHmac("sha256", secret).update(String(ws2)).digest("hex");
    cookieStore.set("gw_active_ws", `${String(ws2)}.${mac}`);

    const { requireOrg } = await load();
    const ctx = await requireOrg();

    // Must resolve to ws1 (the legitimate membership), never ws2.
    expect(ctx.workspaceId).toBe(ws1.toString());
    expect(ctx.workspaceId).not.toBe(ws2.toString());
  });
});

describe("requireOrg — subscription gate", () => {
  it("gated owner (plan=free, everSubscribed=true) redirects to /subscribe", async () => {
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

    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/subscribe");
    expect(redirectMock).toHaveBeenCalledWith("/subscribe");
  });

  it("gated staff member redirects to /subscribe", async () => {
    authUserStub.workosUserId = "user_staff";
    const wsId = new Types.ObjectId();
    await Workspace.create({
      _id: wsId,
      ownerUserId: "user_owner",
      name: "Test",
      slug: `gated-staff-${wsId.toString()}`,
      plan: "free",
      everSubscribed: true,
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      businessType: "photographer",
    });
    await User.create({
      workosUserId: "user_staff",
      email: "staff@test.com",
      memberships: [{ workspaceId: wsId, role: "staff" }],
      onboardingStep: "done",
      onboardingCompletedAt: null,
    });

    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/subscribe");
    expect(redirectMock).toHaveBeenCalledWith("/subscribe");
  });

  it("allowWhenGated=true bypasses the redirect for a gated workspace", async () => {
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

    const { requireOrg } = await load();
    const ctx = await requireOrg({ allowWhenGated: true });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.role).toBe("owner");
  });

  it("never-subscribed free workspace (everSubscribed=false) is NOT redirected", async () => {
    const { wsId } = await makeWorkspaceWithOwner();
    const { requireOrg } = await load();
    const ctx = await requireOrg();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.workspaceId).toBe(wsId.toString());
  });

  it("onboarding-incomplete owner redirects to /onboarding even when also gated (onboarding check runs first)", async () => {
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

    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });
});

describe("requireRole", () => {
  it("returns context when user is owner", async () => {
    await makeWorkspaceWithOwner();
    const { requireRole } = await load();
    const ctx = await requireRole("owner");

    expect(ctx.role).toBe("owner");
  });

  it("throws Forbidden for staff members", async () => {
    authUserStub.workosUserId = "user_staff";
    await makeWorkspaceWithOwner({
      memberWorkosUserId: "user_staff",
      memberRole: "staff",
      onboardingCompletedAt: null,
    });

    const { requireRole } = await load();

    await expect(requireRole("owner")).rejects.toThrow("Forbidden");
  });
});
