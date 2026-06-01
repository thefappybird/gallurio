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
import { Workspace, Booking, Client, User } from "@/lib/db/models";

// ---- External mocks ---------------------------------------------------------

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
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

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/email/resend", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "email_test_id" }, error: null }),
    },
  },
}));

vi.mock("@/lib/email/templates/data-export", () => ({
  buildDataExportEmailBody: vi.fn().mockReturnValue("Your data export is attached."),
}));

// ---- Lazy imports (after mocks are registered) ------------------------------
// We import the actions after vi.mock so that the mocked modules are used.
import {
  updateWorkspaceBusinessAction,
  updateWorkspaceBrandingAction,
  updatePublicPageSettingsAction,
  togglePublicPagePublishedAction,
  deleteWorkspaceAction,
  updateTimeFormatAction,
  requestDataExportAction,
} from "./_actions";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { resend } from "@/lib/email/resend";
import type { Attachment } from "resend";

// ---- Helpers ----------------------------------------------------------------

const OWNER_USER_ID = "user_owner_abc";
const MEMBER_USER_ID = "user_member_xyz";
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

/** Auth mock for a regular member of org A (not the owner). */
function mockAuthAsMemberA() {
  (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: MEMBER_USER_ID,
    orgId: ORG_ID_A,
    orgRole: "org:member",
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
  // Owner must have finished onboarding for ownerContext() to admit them; the
  // settings UI is post-onboarding. Tests that exercise the pre-onboarding
  // path should overwrite this user inside the test.
  await User.create({
    clerkUserId: OWNER_USER_ID,
    email: "owner@test.com",
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    memberships: [],
  });
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

// ---- updateTimeFormatAction --------------------------------------------------

describe("updateTimeFormatAction", () => {
  it("updates timeFormat to 12h and sets cookie", async () => {
    mockAuthAsOwnerA();
    await seedWorkspaceA();
    const mockCookieStore = { get: vi.fn(), set: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await updateTimeFormatAction("12h");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    const user = await User.findOne({ clerkUserId: OWNER_USER_ID }).lean();
    expect(user?.timeFormat).toBe("12h");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "timeFormat",
      "12h",
      expect.objectContaining({ path: "/" })
    );
  });

  it("rejects invalid format value", async () => {
    mockAuthAsOwnerA();
    await seedWorkspaceA();
    const result = await updateTimeFormatAction("invalid");
    expect(result.error).toBeDefined();
  });

  it("non-owner member can update their own time format", async () => {
    // Time format is a per-user preference — members are allowed.
    await seedWorkspaceA();
    // Create a User doc for the member (mirrors the owner doc seeded in beforeEach).
    await User.create({
      clerkUserId: MEMBER_USER_ID,
      email: "member@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [],
    });
    mockAuthAsMemberA();
    const mockCookieStore = { get: vi.fn(), set: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await updateTimeFormatAction("12h");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    // Persisted to the member's own User doc — not the owner's.
    const memberUser = await User.findOne({ clerkUserId: MEMBER_USER_ID }).lean();
    expect(memberUser?.timeFormat).toBe("12h");

    // Owner's doc must be untouched (remains at its default "24h").
    const ownerUser = await User.findOne({ clerkUserId: OWNER_USER_ID }).lean();
    expect(ownerUser?.timeFormat).toBe("24h");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "timeFormat",
      "12h",
      expect.objectContaining({ path: "/" })
    );
  });
});

// ---- requestDataExportAction ------------------------------------------------

describe("requestDataExportAction", () => {
  it("sends email with 3 CSV attachments", async () => {
    mockAuthAsOwnerA();
    await seedWorkspaceA();
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(), set: vi.fn() } as never);

    const result = await requestDataExportAction();
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledOnce();
    const call = vi.mocked(resend.emails.send).mock.calls[0][0];
    const filenames = (call.attachments ?? []).map((a: Attachment) => String(a.filename ?? ""));
    expect(filenames).toContain("bookings.csv");
    expect(filenames).toContain("clients.csv");
    expect(filenames).toContain("inquiries.csv");
  });

  it("returns error when Resend fails", async () => {
    mockAuthAsOwnerA();
    await seedWorkspaceA();
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(), set: vi.fn() } as never);
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "bad sender" },
    } as never);

    const result = await requestDataExportAction();
    expect(result.error).toBeDefined();
  });
});
