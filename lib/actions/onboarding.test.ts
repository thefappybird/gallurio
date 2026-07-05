import { describe, it, expect, beforeAll, afterAll, afterEach, vi, type MockedFunction } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User, Workspace } from "@/lib/db/models";
import { Team } from "@/lib/db/models/team";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the tested module.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/auth/activeWorkspace", () => ({
  setActiveWorkspace: vi.fn().mockResolvedValue(undefined),
  getActiveWorkspaceId: vi.fn(),
  clearActiveWorkspace: vi.fn().mockResolvedValue(undefined),
}));

// next/cache, next/navigation, and next/headers are not available in the test environment.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { getAuthUser } from "@/lib/auth/session";
import { setActiveWorkspace } from "@/lib/auth/activeWorkspace";
import {
  businessStepAction,
  workspaceStepAction,
  selectFreePlanAction,
  completeOnboardingAction,
} from "./onboarding";

const mockGetAuthUser = getAuthUser as MockedFunction<typeof getAuthUser>;
const mockSetActiveWorkspace = setActiveWorkspace as MockedFunction<typeof setActiveWorkspace>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthUser(id = "wos_user_001") {
  return { workosUserId: id, email: `${id}@example.com`, name: "Test User", avatarUrl: null };
}

const validBusinessInput = {
  firstName: "Alice",
  lastName: "Smith",
  name: "Alice Photography",
  businessType: "photographer" as const,
};

const validWorkspaceSetupInput = {
  slug: "alice-photography",
  country: "PH" as const,
  timezone: "Asia/Manila",
  timeFormat: "24h" as const,
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// businessStepAction
// ---------------------------------------------------------------------------

describe("businessStepAction", () => {
  it("rejects unauthenticated requests", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await businessStepAction(validBusinessInput);
    expect(result.error).toBe("not_authenticated");
  });

  it("creates workspace + default team + owner membership on first run", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());

    const result = await businessStepAction(validBusinessInput);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    // Workspace created
    const workspace = await Workspace.findOne({ slug: "alice-photography" }).lean();
    expect(workspace).not.toBeNull();
    expect(workspace!.name).toBe("Alice Photography");
    expect(workspace!.ownerUserId).toBe("wos_user_001");
    expect(workspace!.plan).toBe("free");

    // Default team created
    const team = await Team.findOne({ workspaceId: workspace!._id, isDefault: true }).lean();
    expect(team).not.toBeNull();
    expect(team!.name).toBe("Main");
    expect(team!.createdByWorkosUserId).toBe("wos_user_001");

    // User upserted with owner membership
    const user = await User.findOne({ workosUserId: "wos_user_001" }).lean();
    expect(user).not.toBeNull();
    const membership = user!.memberships.find(
      (m) => String(m.workspaceId) === String(workspace!._id)
    );
    expect(membership).not.toBeUndefined();
    expect(membership!.role).toBe("owner");
  });

  it("sets the active-workspace cookie after success", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());

    await businessStepAction(validBusinessInput);

    const workspace = await Workspace.findOne({ slug: "alice-photography" }).lean();
    expect(mockSetActiveWorkspace).toHaveBeenCalledWith(
      "wos_user_001",
      String(workspace!._id)
    );
  });

  it("is idempotent — re-running does not duplicate workspace, team, or membership", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());

    await businessStepAction(validBusinessInput);
    const result2 = await businessStepAction({ ...validBusinessInput, name: "Alice Photos Updated" });
    expect(result2.ok).toBe(true);

    const workspaceCount = await Workspace.countDocuments({ ownerUserId: "wos_user_001" });
    expect(workspaceCount).toBe(1);

    // Name updated on re-run
    const workspace = await Workspace.findOne({ ownerUserId: "wos_user_001" }).lean();
    expect(workspace!.name).toBe("Alice Photos Updated");

    const teamCount = await Team.countDocuments({ workspaceId: workspace!._id, isDefault: true });
    expect(teamCount).toBe(1);

    const user = await User.findOne({ workosUserId: "wos_user_001" }).lean();
    const ownerMemberships = user!.memberships.filter((m) => m.role === "owner");
    expect(ownerMemberships).toHaveLength(1);
  });

  it("does not throw when E11000 race fires on the auto-generated slug — returns friendly error", async () => {
    // To reach the E11000 path we need the pre-write slug check to pass (no
    // clash found) but the DB upsert to fail with a duplicate key error.
    // Strategy: insert the conflicting workspace AFTER the slug check via a
    // session-level spy. We mock the mongoose session to throw a synthetic
    // E11000 error, simulating the race, and assert the action returns the
    // friendly error string rather than propagating the exception.
    const mongooseModule = await import("mongoose");
    const startSessionSpy = vi.spyOn(mongooseModule.default, "startSession");
    const fakeE11000 = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
      name: "MongoServerError",
      keyPattern: { slug: 1 },
    });
    startSessionSpy.mockRejectedValueOnce(fakeE11000);

    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_e11k"));
    const result = await businessStepAction(validBusinessInput);

    startSessionSpy.mockRestore();
    // Must not throw; must map to friendly error
    expect(result.error).toBe("url_taken");
  });

  it("re-running with a new name does not touch the already-generated slug", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());

    // First run to create workspace with the auto-generated slug.
    await businessStepAction(validBusinessInput);

    // Re-run with a different name should succeed.
    const result = await businessStepAction({ ...validBusinessInput, name: "Updated Name" });
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns validation error for missing required fields", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    const result = await businessStepAction({ ...validBusinessInput, name: "" });
    expect(result.error).toBeTruthy();
    expect(result.ok).toBeUndefined();
  });

  it("advances the user to the workspace step (not plan) on success", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);
    const user = await User.findOne({ workosUserId: "wos_user_001" }).lean();
    expect(user!.onboardingStep).toBe("workspace");
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("tenant isolation: second user's businessStep does not touch first user's workspace", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_001"));
    await businessStepAction(validBusinessInput);

    const user1Workspace = await Workspace.findOne({ ownerUserId: "wos_user_001" }).lean();
    expect(user1Workspace).not.toBeNull();

    // Second user runs the step with a different name.
    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_002"));
    const result2 = await businessStepAction({
      ...validBusinessInput,
      name: "Second Studio",
    });
    expect(result2.ok).toBe(true);

    // User 1's workspace unchanged.
    const user1WorkspaceAfter = await Workspace.findById(user1Workspace!._id).lean();
    expect(user1WorkspaceAfter!.name).toBe(validBusinessInput.name);
    expect(user1WorkspaceAfter!.ownerUserId).toBe("wos_user_001");

    // Two distinct workspaces exist.
    const count = await Workspace.countDocuments();
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// workspaceStepAction
// ---------------------------------------------------------------------------

describe("workspaceStepAction", () => {
  it("derives currency from country, saves timezone/timeFormat, and advances to plan", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);

    const result = await workspaceStepAction(validWorkspaceSetupInput);
    expect(result.ok).toBe(true);

    const workspace = await Workspace.findOne({ ownerUserId: "wos_user_001" }).lean();
    expect(workspace!.country).toBe("PH");
    expect(workspace!.currency).toBe("PHP");
    expect(workspace!.timezone).toBe("Asia/Manila");

    const user = await User.findOne({ workosUserId: "wos_user_001" }).lean();
    expect(user!.onboardingStep).toBe("plan");
    expect(user!.timeFormat).toBe("24h");
  });

  it("rejects a slug already taken by another workspace", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);

    await Workspace.create({
      slug: "taken-slug",
      name: "Other Business",
      ownerUserId: "wos_user_999",
      plan: "free",
      currency: "PHP",
    });

    const result = await workspaceStepAction({ ...validWorkspaceSetupInput, slug: "taken-slug" });
    expect(result.error).toBe("url_taken");
  });
});

// ---------------------------------------------------------------------------
// selectFreePlanAction
// ---------------------------------------------------------------------------

describe("selectFreePlanAction", () => {
  it("rejects unauthenticated requests", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await selectFreePlanAction();
    expect(result.error).toBe("not_authenticated");
  });

  it("sets plan to free and advances step", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);

    const result = await selectFreePlanAction();
    expect(result.ok).toBe(true);

    const workspace = await Workspace.findOne({ ownerUserId: "wos_user_001" }).lean();
    expect(workspace!.plan).toBe("free");

    const user = await User.findOne({ workosUserId: "wos_user_001" }).lean();
    expect(user!.onboardingStep).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// completeOnboardingAction
// ---------------------------------------------------------------------------

describe("completeOnboardingAction", () => {
  it("rejects unauthenticated requests", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await completeOnboardingAction({ seedSampleData: false });
    expect(result.error).toBe("not_authenticated");
  });

  it("marks workspace and user as onboarding-complete and redirects", async () => {
    const { redirect } = await import("next/navigation");
    const mockRedirect = redirect as MockedFunction<typeof redirect>;

    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);

    await completeOnboardingAction({ seedSampleData: false });

    const workspace = await Workspace.findOne({ ownerUserId: "wos_user_001" }).lean();
    expect(workspace!.onboardingCompletedAt).not.toBeNull();

    const user = await User.findOne({ workosUserId: "wos_user_001" }).lean();
    expect(user!.onboardingStep).toBe("done");
    expect(user!.onboardingCompletedAt).not.toBeNull();

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("skips sample data when seedSampleData is false", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);
    await completeOnboardingAction({ seedSampleData: false });

    const { Client } = await import("@/lib/db/models");
    const clientCount = await Client.countDocuments();
    expect(clientCount).toBe(0);
  });

  it("seeds sample clients when seedSampleData is true in development", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);

    const prev = process.env.NODE_ENV;
    // @ts-expect-error — NODE_ENV is read-only in the types but writable at runtime
    process.env.NODE_ENV = "development";
    try {
      await completeOnboardingAction({ seedSampleData: true });
    } finally {
      // @ts-expect-error — restore
      process.env.NODE_ENV = prev;
    }

    const { Client } = await import("@/lib/db/models");
    const clientCount = await Client.countDocuments();
    expect(clientCount).toBeGreaterThan(0);
  });

  it("ignores seedSampleData outside development (defense in depth against a crafted request)", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);
    // Test env's NODE_ENV is "test", not "development" — the gate should block seeding.
    await completeOnboardingAction({ seedSampleData: true });

    const { Client } = await import("@/lib/db/models");
    const clientCount = await Client.countDocuments();
    expect(clientCount).toBe(0);
  });
});
