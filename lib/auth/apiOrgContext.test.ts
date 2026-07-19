import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User } from "@/lib/db/models";

// Minimal coverage: this module had no prior test file. Only the new
// subscription-gate branches are covered here, not a full re-test of
// requireApiOrg's existing auth/onboarding logic.

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

process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "test-secret-apiorgctx";

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

async function load() {
  return import("./apiOrgContext");
}

async function makeGatedWorkspace(): Promise<Types.ObjectId> {
  const wsId = new Types.ObjectId();
  await Workspace.create({
    _id: wsId,
    ownerUserId: "user_owner",
    name: "Test",
    slug: `gated-${wsId.toString()}`,
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
  return wsId;
}

describe("requireApiOrg — subscription gate", () => {
  it("gated workspace returns 402 with subscription_required", async () => {
    await makeGatedWorkspace();
    const { requireApiOrg } = await load();
    const result = await requireApiOrg();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(402);
      const body = await result.response.json();
      expect(body.error).toBe("subscription_required");
    }
  });

  it("allowWhenGated=true bypasses the gate for a gated workspace", async () => {
    await makeGatedWorkspace();
    const { requireApiOrg } = await load();
    const result = await requireApiOrg({ allowWhenGated: true });

    expect(result.ok).toBe(true);
  });
});
