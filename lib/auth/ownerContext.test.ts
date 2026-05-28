import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User } from "@/lib/db/models";

const session = {
  userId: "user_owner",
  orgId: "org_test",
  orgRole: "org:admin" as string | undefined,
};

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ ...session }),
}));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  session.userId = "user_owner";
  session.orgId = "org_test";
  session.orgRole = "org:admin";
});

async function makeWorkspace(): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    clerkOrgId: "org_test",
    ownerUserId: "user_owner",
    name: "Test",
    slug: "test",
    plan: "free",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });
  return ws._id;
}

async function load() {
  return import("./ownerContext");
}

describe("ownerContext — onboarding gate", () => {
  it("rejects an owner who has not completed onboarding", async () => {
    await makeWorkspace();
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "business",
      onboardingCompletedAt: null,
      memberships: [],
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/onboarding/i);
    }
  });

  it("admits an owner who has finished onboarding", async () => {
    await makeWorkspace();
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [],
    });

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.userId).toBe("user_owner");
      expect(result.clerkOrgId).toBe("org_test");
    }
  });

  it("respects allowDuringOnboarding=true escape hatch", async () => {
    await makeWorkspace();
    await User.create({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      onboardingStep: "business",
      onboardingCompletedAt: null,
      memberships: [],
    });

    const { ownerContext } = await load();
    const result = await ownerContext({ allowDuringOnboarding: true });
    expect("error" in result).toBe(false);
  });

  it("rejects a non-owner trying to use owner-only context", async () => {
    await makeWorkspace();
    await User.create({
      clerkUserId: "user_member",
      email: "m@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [],
    });

    session.userId = "user_member";
    session.orgRole = "org:member";

    const { ownerContext } = await load();
    const result = await ownerContext();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/owner/i);
    }
  });
});
