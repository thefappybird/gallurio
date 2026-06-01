import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User } from "@/lib/db/models";

// ---------------------------------------------------------------------------
// Mutable session stub — tests mutate this object to simulate different users.
// ---------------------------------------------------------------------------
const session = {
  userId: "user_owner" as string | null,
  orgId: "org_test" as string | null,
  orgRole: "org:admin" as string | undefined,
};

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ ...session }),
}));

// next-intl locale — fixed to "en" so localized() returns bare paths.
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
}));

// Capture redirect calls so we can assert on them without throwing.
const redirectMock = vi.fn((_url: string): never => {
  throw new Error(`REDIRECT:${_url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

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
  redirectMock.mockClear();
  // Reset to a default owner session.
  session.userId = "user_owner";
  session.orgId = "org_test";
  session.orgRole = "org:admin";
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function makeWorkspace(): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    clerkOrgId: "org_test",
    ownerUserId: "user_owner",
    name: "Test Workspace",
    slug: "test-workspace",
    plan: "free",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });
  return ws._id;
}

async function load() {
  // Dynamic import so vi.mock() hoisting has settled before the module runs.
  return import("./requireOrg");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("requireOrg — member onboarding gate fix", () => {
  it("staff member with onboardingCompletedAt=null is NOT redirected and gets role='staff'", async () => {
    await makeWorkspace();
    // Member user — no onboardingCompletedAt set.
    await User.create({
      clerkUserId: "user_member",
      email: "member@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: null,
      memberships: [],
    });

    session.userId = "user_member";
    session.orgRole = "org:member"; // non-admin

    const { requireOrg } = await load();
    const ctx = await requireOrg();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.role).toBe("staff");
    expect(ctx.userId).toBe("user_member");
    expect(ctx.clerkOrgId).toBe("org_test");
  });

  it("owner with onboardingCompletedAt=null IS redirected to /onboarding", async () => {
    await makeWorkspace();
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "business",
      onboardingCompletedAt: null,
      memberships: [],
    });

    // session is already org:admin + userId user_owner (set in beforeEach)
    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("owner with completed onboarding returns role='owner'", async () => {
    await makeWorkspace();
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [],
    });

    const { requireOrg } = await load();
    const ctx = await requireOrg();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.role).toBe("owner");
    expect(ctx.userId).toBe("user_owner");
  });

  it("missing workspace redirects to /onboarding regardless of role", async () => {
    // No workspace created — workspace lookup will return null.
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [],
    });

    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("allowDuringOnboarding=true lets an owner through even without onboardingCompletedAt", async () => {
    await makeWorkspace();
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "business",
      onboardingCompletedAt: null,
      memberships: [],
    });

    const { requireOrg } = await load();
    const ctx = await requireOrg({ allowDuringOnboarding: true });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.role).toBe("owner");
  });

  it("staff member whose userId matches workspace.ownerUserId is still treated as owner", async () => {
    // Edge-case: Clerk reports org:member but the DB ownerUserId matches.
    // The DB truth wins (ownerUserId check in isOwner).
    await makeWorkspace(); // ownerUserId: "user_owner"
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [],
    });

    // Simulate Clerk reporting the wrong role (degraded session, etc.).
    session.orgRole = "org:member";

    const { requireOrg } = await load();
    const ctx = await requireOrg();

    expect(ctx.role).toBe("owner");
  });

  it("unauthenticated user (no userId) redirects to /sign-in", async () => {
    session.userId = null;
    session.orgId = null;

    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/sign-in");
    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });

  it("authenticated user with no active org redirects to /onboarding", async () => {
    session.orgId = null;

    const { requireOrg } = await load();

    await expect(requireOrg()).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });
});
