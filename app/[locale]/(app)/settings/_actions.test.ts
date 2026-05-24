/**
 * Tests for settings server actions.
 *
 * Mongo: uses in-memory server — never mock Mongoose.
 * Clerk + HitPay + Cloudinary + next/cache: mocked.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, Booking, Client } from "@/lib/db/models";

// ---- External mocks ---------------------------------------------------------

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/hitpay/client", () => ({
  cancelRecurringBilling: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/storage/cloudinary", () => ({
  destroyAsset: vi.fn().mockResolvedValue(undefined),
}));

// connectDB is called inside every action. In tests the in-memory Mongo is
// already connected, so we make connectDB a no-op to avoid it trying to use
// the real DATABASE_URL env var.
vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

// ---- Lazy imports (after mocks are registered) ------------------------------
// We import the actions after vi.mock so that the mocked modules are used.
import {
  updateWorkspaceBusinessAction,
  updateWorkspaceBrandingAction,
  updatePublicPageSettingsAction,
  togglePublicPagePublishedAction,
  deleteWorkspaceAction,
} from "./_actions";
import { auth, clerkClient } from "@clerk/nextjs/server";

// ---- Helpers ----------------------------------------------------------------

const OWNER_USER_ID = "user_owner_abc";
const ORG_ID_A = "org_aaa";
const ORG_ID_B = "org_bbb";

/** Reset Clerk auth mock to return org A as the owner. */
function mockAuthAsOwnerA() {
  (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: OWNER_USER_ID,
    orgId: ORG_ID_A,
    orgRole: "org:admin",
  });
}

/** Return a minimal Clerk client stub. */
function makeClerkClientStub() {
  return {
    organizations: {
      updateOrganization: vi.fn().mockResolvedValue({}),
      deleteOrganization: vi.fn().mockResolvedValue({}),
    },
  };
}

async function seedWorkspaceA() {
  return Workspace.create({
    slug: "sarah-photo",
    name: "Sarah Photography",
    ownerUserId: OWNER_USER_ID,
    clerkOrgId: ORG_ID_A,
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
  });
}

async function seedWorkspaceB() {
  return Workspace.create({
    slug: "other-studio",
    name: "Other Studio",
    ownerUserId: "user_other",
    clerkOrgId: ORG_ID_B,
    businessType: "venue",
    country: "SG",
    currency: "SGD",
    timezone: "Asia/Singapore",
  });
}

// ---- Suite setup ------------------------------------------------------------

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
  mockAuthAsOwnerA();
  (clerkClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeClerkClientStub());
});

// ---- updateWorkspaceBusinessAction ------------------------------------------

describe("updateWorkspaceBusinessAction", () => {
  const validInput = {
    name: "Sarah Bell Photography",
    slug: "sarah-photo",
    businessType: "photographer" as const,
    country: "PH" as const,
    currency: "PHP" as const,
    timezone: "Asia/Manila",
  };

  it("owner happy path — updates the workspace doc", async () => {
    await seedWorkspaceA();

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      name: "Sarah Bell Studios",
      timezone: "Asia/Kolkata",
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    const updated = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(updated?.name).toBe("Sarah Bell Studios");
    expect(updated?.timezone).toBe("Asia/Kolkata");
  });

  it("slug collision — rejects with error and does NOT update", async () => {
    await seedWorkspaceA();
    await seedWorkspaceB();

    // Try to claim workspace B's slug from workspace A's session
    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      slug: "other-studio",
    });

    expect(result.error).toMatch(/already taken/i);

    // Workspace A's slug must be unchanged
    const wsA = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(wsA?.slug).toBe("sarah-photo");
  });

  it("tenant isolation — workspace B is NOT touched", async () => {
    await seedWorkspaceA();
    const wsB = await seedWorkspaceB();

    await updateWorkspaceBusinessAction({ ...validInput, name: "Updated A" });

    const wsBAfter = await Workspace.findById(wsB._id).lean();
    expect(wsBAfter?.name).toBe("Other Studio");
    expect(wsBAfter?.slug).toBe("other-studio");
  });

  it("role gating — non-owner gets error and doc is unchanged", async () => {
    await seedWorkspaceA();

    // Auth returns a user who is a member (not the doc's ownerUserId)
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "user_some_member",
      orgId: ORG_ID_A,
      orgRole: "org:member",
    });

    const result = await updateWorkspaceBusinessAction({ ...validInput, name: "Hacked Name" });

    expect(result.error).toBe("Only the workspace owner can change this");

    const ws = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(ws?.name).toBe("Sarah Photography");
  });
});

// ---- updateWorkspaceBrandingAction ------------------------------------------

describe("updateWorkspaceBrandingAction", () => {
  it("updates branding fields", async () => {
    await seedWorkspaceA();

    const result = await updateWorkspaceBrandingAction({
      primaryColor: "#222222",
      secondaryColor: "#eeeeee",
      tagline: "Moments forever.",
      description: "We photograph love.",
    });

    expect(result.ok).toBe(true);

    const ws = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(ws?.branding?.primaryColor).toBe("#222222");
    expect(ws?.branding?.tagline).toBe("Moments forever.");
  });

  it("rejects invalid hex color", async () => {
    await seedWorkspaceA();

    const result = await updateWorkspaceBrandingAction({
      primaryColor: "not-a-color",
      secondaryColor: "#eeeeee",
      tagline: "",
      description: "",
    });

    expect(result.error).toBeTruthy();
  });
});

// ---- updatePublicPageSettingsAction -----------------------------------------

describe("updatePublicPageSettingsAction", () => {
  it("updates SEO and inquiry fields", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      seoTitle: "Sarah Bell Photography",
      seoDescription: "Wedding photography in the Philippines.",
      inquiryRecipientEmail: "sarah@example.com",
    });

    expect(result.ok).toBe(true);

    const ws = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(ws?.publicPage?.seoTitle).toBe("Sarah Bell Photography");
    expect(ws?.publicPage?.inquiryRecipientEmail).toBe("sarah@example.com");
  });

  it("rejects an invalid email", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      seoTitle: "",
      seoDescription: "",
      inquiryRecipientEmail: "bad-email",
    });

    expect(result.error).toBeTruthy();
  });
});

// ---- togglePublicPagePublishedAction ----------------------------------------

describe("togglePublicPagePublishedAction", () => {
  it("toggling to true sets publishedAt to a Date", async () => {
    await seedWorkspaceA();

    const result = await togglePublicPagePublishedAction(true);
    expect(result.ok).toBe(true);

    const ws = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(ws?.publicPage?.publishedAt).toBeInstanceOf(Date);
  });

  it("toggling to false sets publishedAt to null", async () => {
    // First publish, then unpublish
    await seedWorkspaceA();
    await togglePublicPagePublishedAction(true);
    await togglePublicPagePublishedAction(false);

    const ws = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(ws?.publicPage?.publishedAt).toBeNull();
  });
});

// ---- deleteWorkspaceAction --------------------------------------------------

describe("deleteWorkspaceAction", () => {
  it("wrong confirmation — returns error and workspace still exists", async () => {
    await seedWorkspaceA();

    const result = await deleteWorkspaceAction("wrong-slug");

    expect(result.error).toBeTruthy();

    const ws = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(ws).not.toBeNull();
  });

  it("correct confirmation — deletes workspace and related bookings", async () => {
    const ws = await seedWorkspaceA();

    // Seed a related booking
    const client = await Client.create({
      workspaceId: ws._id,
      name: "Emma Carter",
    });
    await Booking.create({
      workspaceId: ws._id,
      clientId: client._id,
      clientName: "Emma Carter",
      title: "Carter Wedding",
      status: "booked",
      sessions: [
        {
          startAt: new Date("2026-08-15T10:00:00Z"),
          endAt: new Date("2026-08-15T18:00:00Z"),
        },
      ],
      firstSessionStart: new Date("2026-08-15T10:00:00Z"),
      lastSessionEnd: new Date("2026-08-15T18:00:00Z"),
    });

    const result = await deleteWorkspaceAction("sarah-photo");

    expect(result.ok).toBe(true);

    const wsAfter = await Workspace.findOne({ clerkOrgId: ORG_ID_A }).lean();
    expect(wsAfter).toBeNull();

    const bookings = await Booking.find({ workspaceId: ws._id }).lean();
    expect(bookings).toHaveLength(0);
  });
});
