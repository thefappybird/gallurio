import { describe, it, expect, beforeAll, afterAll, afterEach, vi, type MockedFunction } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User, Workspace } from "@/lib/db/models";
import { Team } from "@/lib/db/models/team";
import mongoose from "mongoose";

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

// next/cache and next/navigation are not available in the test environment.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { getAuthUser } from "@/lib/auth/session";
import { setActiveWorkspace } from "@/lib/auth/activeWorkspace";
import {
  businessStepAction,
  brandingStepAction,
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
  slug: "alice-photography",
  businessType: "photographer" as const,
  country: "PH" as const,
  currency: "PHP" as const,
  timezone: "Asia/Manila",
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
    expect(result.error).toBe("Not authenticated");
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

  it("rejects a slug already taken by another workspace", async () => {
    // Create another user's workspace with the same slug.
    await Workspace.create({
      slug: "alice-photography",
      name: "Other Business",
      ownerUserId: "wos_user_999",
      plan: "free",
      currency: "PHP",
    });

    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_001"));
    const result = await businessStepAction(validBusinessInput);
    expect(result.error).toMatch(/slug.*taken/i);
  });

  it("allows the user to keep their own slug on re-run", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());

    // First run to create workspace with the slug.
    await businessStepAction(validBusinessInput);

    // Re-run with same slug should succeed (not clash with own workspace).
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

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("tenant isolation: second user's businessStep does not touch first user's workspace", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_001"));
    await businessStepAction(validBusinessInput);

    const user1Workspace = await Workspace.findOne({ ownerUserId: "wos_user_001" }).lean();
    expect(user1Workspace).not.toBeNull();

    // Second user runs the step with a different slug.
    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_002"));
    const result2 = await businessStepAction({
      ...validBusinessInput,
      slug: "second-studio",
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
// brandingStepAction
// ---------------------------------------------------------------------------

describe("brandingStepAction", () => {
  it("rejects unauthenticated requests", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await brandingStepAction({
      primaryColor: "#111111",
      secondaryColor: "#f5f5f5",
      tagline: "",
      description: "",
    });
    expect(result.error).toBe("Not authenticated");
  });

  it("rejects when no owner membership exists", async () => {
    // User exists but has no memberships.
    await User.create({
      workosUserId: "wos_user_001",
      email: "test@example.com",
      memberships: [],
    });
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    const result = await brandingStepAction({
      primaryColor: "#111111",
      secondaryColor: "#f5f5f5",
      tagline: "",
      description: "",
    });
    expect(result.error).toMatch(/no active workspace/i);
  });

  it("updates branding fields on the owner workspace", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);

    const result = await brandingStepAction({
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      tagline: "Capturing moments",
      description: "Professional photography",
    });
    expect(result.ok).toBe(true);

    const workspace = await Workspace.findOne({ ownerUserId: "wos_user_001" }).lean();
    expect(workspace).not.toBeNull();
    expect(workspace?.branding?.primaryColor).toBe("#ff0000");
    expect(workspace?.branding?.tagline).toBe("Capturing moments");
  });
});

// ---------------------------------------------------------------------------
// selectFreePlanAction
// ---------------------------------------------------------------------------

describe("selectFreePlanAction", () => {
  it("rejects unauthenticated requests", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await selectFreePlanAction();
    expect(result.error).toBe("Not authenticated");
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
    expect(result.error).toBe("Not authenticated");
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

  it("seeds sample clients when seedSampleData is true", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    await businessStepAction(validBusinessInput);
    await completeOnboardingAction({ seedSampleData: true });

    const { Client } = await import("@/lib/db/models");
    const clientCount = await Client.countDocuments();
    expect(clientCount).toBeGreaterThan(0);
  });
});
