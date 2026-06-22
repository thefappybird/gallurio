import { describe, it, expect, beforeAll, afterAll, afterEach, vi, type MockedFunction } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User, Workspace } from "@/lib/db/models";
import { __resetRateLimitForTests } from "@/lib/server/rateLimit";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the tested module.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { getAuthUser } from "@/lib/auth/session";
import { checkSlugAvailabilityAction } from "./slug";

const mockGetAuthUser = getAuthUser as MockedFunction<typeof getAuthUser>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthUser(id = "wos_user_001") {
  return {
    workosUserId: id,
    email: `${id}@example.com`,
    name: "Test User",
    avatarUrl: null,
  };
}

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
  __resetRateLimitForTests();
});

// ---------------------------------------------------------------------------
// checkSlugAvailabilityAction
// ---------------------------------------------------------------------------

describe("checkSlugAvailabilityAction", () => {
  it("returns invalid for a slug that fails the format validator", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    const result = await checkSlugAvailabilityAction("INVALID SLUG!");
    expect(result).toEqual({ available: false, reason: "invalid" });
  });

  it("returns available for a slug that does not exist in the DB", async () => {
    mockGetAuthUser.mockResolvedValue(makeAuthUser());
    const result = await checkSlugAvailabilityAction("my-new-slug");
    expect(result).toEqual({ available: true });
  });

  it("returns taken for a slug that belongs to a different workspace", async () => {
    // Create another user's workspace with the slug we'll check
    await Workspace.create({
      slug: "taken-slug",
      name: "Other Workspace",
      ownerUserId: "wos_user_other",
      businessType: "photographer",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      plan: "free",
    });
    await User.create({
      workosUserId: "wos_user_other",
      email: "other@example.com",
      memberships: [],
    });

    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_001"));
    await User.create({
      workosUserId: "wos_user_001",
      email: "user001@example.com",
      memberships: [],
    });

    const result = await checkSlugAvailabilityAction("taken-slug");
    expect(result).toEqual({ available: false, reason: "taken" });
  });

  it("excludes caller's own workspace — returns available when the slug is already theirs", async () => {
    const ws = await Workspace.create({
      slug: "my-own-slug",
      name: "My Workspace",
      ownerUserId: "wos_user_001",
      businessType: "photographer",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      plan: "free",
    });
    await User.create({
      workosUserId: "wos_user_001",
      email: "user001@example.com",
      memberships: [{ workspaceId: ws._id, role: "owner" }],
    });

    mockGetAuthUser.mockResolvedValue(makeAuthUser("wos_user_001"));

    const result = await checkSlugAvailabilityAction("my-own-slug");
    expect(result).toEqual({ available: true });
  });

  it("returns invalid for unauthenticated requests (cannot check without session)", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await checkSlugAvailabilityAction("some-slug");
    expect(result).toEqual({ available: false, reason: "invalid" });
  });
});
