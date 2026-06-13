/**
 * Tests for settings server actions.
 *
 * Mongo: uses in-memory server — never mock Mongoose.
 * WorkOS + Paddle + Cloudinary + next/cache: mocked.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Types } from "mongoose";
import { Workspace, Booking, Client, User } from "@/lib/db/models";

// ---- External mocks ---------------------------------------------------------

// authkit-nextjs imports next/cache which is not resolvable in the test env.
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
  saveSession: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  setRequestLocale: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/paddle/client", () => ({
  cancelSubscription: vi.fn().mockResolvedValue(undefined),
  getPaddle: vi.fn(),
  ensurePaddleCustomer: vi.fn(),
  getSubscription: vi.fn(),
  listActiveSubscriptionsForCustomer: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/storage/cloudinary", () => ({
  destroyAsset: vi.fn().mockResolvedValue(undefined),
}));

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
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "email_test_id" }, error: null }),
    },
  },
}));

vi.mock("@/lib/email/templates/data-export", () => ({
  buildDataExportEmailBody: vi
    .fn()
    .mockReturnValue("Your data export is attached."),
}));

// Hoist shared state so vi.mock factories can access it before initialization.
const { mockWorkos, mockGetAuthUser } = vi.hoisted(() => {
  const mockWorkos = {
    userManagement: {
      updateUser: vi.fn(),
      authenticateWithPassword: vi.fn(),
      createPasswordReset: vi.fn(),
      getUserIdentities: vi.fn(),
    },
    multiFactorAuth: {
      createUserAuthFactor: vi.fn(),
      listUserAuthFactors: vi.fn(),
      verifyChallenge: vi.fn(),
      deleteFactor: vi.fn(),
    },
  };
  const mockGetAuthUser = vi.fn();
  return { mockWorkos, mockGetAuthUser };
});

vi.mock("@/lib/workos", () => ({ workos: mockWorkos }));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/server/authRateLimit", () => ({
  checkAuthRateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/email/sendPasswordResetEmail", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock activeWorkspace helpers
vi.mock("@/lib/auth/activeWorkspace", () => ({
  getActiveWorkspaceId: vi.fn(),
  setActiveWorkspace: vi.fn().mockResolvedValue(undefined),
  clearActiveWorkspace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/i18n/routing", () => ({
  routing: { defaultLocale: "en", locales: ["en", "fil", "ms", "id"] },
}));

// ---- Lazy imports (after mocks are registered) ------------------------------

import {
  updateWorkspaceBusinessAction,
  updateWorkspaceBrandingAction,
  updatePublicPageSettingsAction,
  togglePublicPagePublishedAction,
  deleteWorkspaceAction,
  updateTimeFormatAction,
  requestDataExportAction,
  updateProfileNameAction,
  enrollMfaAction,
  verifyMfaEnrollmentAction,
  disableMfaAction,
  setActiveWorkspaceAction,
  updatePasswordAction,
} from "./_actions";
import { cookies } from "next/headers";
import { resend } from "@/lib/email/resend";
import type { Attachment } from "resend";
import { cancelSubscription } from "@/lib/paddle/client";
import { setActiveWorkspace } from "@/lib/auth/activeWorkspace";
import { getActiveWorkspaceId } from "@/lib/auth/activeWorkspace";
import { checkAuthRateLimit } from "@/lib/server/authRateLimit";
import { AuthenticationException } from "@workos-inc/node";

// ---- Helpers ----------------------------------------------------------------

const OWNER_WORKOS_ID = "user_owner_abc";
const MEMBER_WORKOS_ID = "user_member_xyz";
const WS_A_ID = new Types.ObjectId();
const WS_B_ID = new Types.ObjectId();

function mockAuthAsOwnerA() {
  mockGetAuthUser.mockResolvedValue({
    workosUserId: OWNER_WORKOS_ID,
    email: "owner@test.com",
    name: "Owner User",
    avatarUrl: null,
  });
}

function mockAuthAsMemberA() {
  mockGetAuthUser.mockResolvedValue({
    workosUserId: MEMBER_WORKOS_ID,
    email: "member@test.com",
    name: "Member User",
    avatarUrl: null,
  });
}

async function seedWorkspaceA() {
  return Workspace.create({
    _id: WS_A_ID,
    slug: "sarah-photo",
    name: "Sarah Photography",
    ownerUserId: OWNER_WORKOS_ID,
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
  });
}

async function seedWorkspaceB() {
  return Workspace.create({
    _id: WS_B_ID,
    slug: "other-studio",
    name: "Other Studio",
    ownerUserId: "user_other",
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
  vi.mocked(getActiveWorkspaceId).mockResolvedValue(String(WS_A_ID));

  await User.create({
    workosUserId: OWNER_WORKOS_ID,
    email: "owner@test.com",
    name: "Owner User",
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    memberships: [{ workspaceId: WS_A_ID, role: "owner" }],
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

    const updated = await Workspace.findById(WS_A_ID).lean();
    expect(updated?.name).toBe("Sarah Bell Studios");
    expect(updated?.timezone).toBe("Asia/Kolkata");
  });

  it("slug collision — rejects with error and does NOT update", async () => {
    await seedWorkspaceA();
    await seedWorkspaceB();

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      slug: "other-studio",
    });

    expect(result.error).toMatch(/already taken/i);

    const wsA = await Workspace.findById(WS_A_ID).lean();
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

    // Seed a User doc for the member (ownerContext must be able to load it)
    await User.create({
      workosUserId: "user_some_member",
      email: "member@test.com",
      name: "Member",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [{ workspaceId: WS_A_ID, role: "staff" }],
    });

    mockGetAuthUser.mockResolvedValue({
      workosUserId: "user_some_member",
      email: "member@test.com",
      name: "Member",
      avatarUrl: null,
    });

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      name: "Hacked Name",
    });

    expect(result.error).toBe("Only the workspace owner can change this");

    const ws = await Workspace.findById(WS_A_ID).lean();
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

    const ws = await Workspace.findById(WS_A_ID).lean();
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

    const ws = await Workspace.findById(WS_A_ID).lean();
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

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.publicPage?.publishedAt).toBeInstanceOf(Date);
  });

  it("toggling to false sets publishedAt to null", async () => {
    await seedWorkspaceA();
    await togglePublicPagePublishedAction(true);
    await togglePublicPagePublishedAction(false);

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.publicPage?.publishedAt).toBeNull();
  });
});

// ---- deleteWorkspaceAction --------------------------------------------------

describe("deleteWorkspaceAction", () => {
  it("wrong confirmation — returns error and workspace still exists", async () => {
    await seedWorkspaceA();

    const result = await deleteWorkspaceAction("wrong-slug");

    expect(result.error).toBeTruthy();

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws).not.toBeNull();
  });

  it("correct confirmation — deletes workspace and related bookings", async () => {
    const ws = await seedWorkspaceA();

    const client = await Client.create({
      workspaceId: ws._id,
      name: "Emma Carter",
    });
    await Booking.create({
      workspaceId: ws._id,
      teamId: new Types.ObjectId(),
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

    const wsAfter = await Workspace.findById(WS_A_ID).lean();
    expect(wsAfter).toBeNull();

    const bookings = await Booking.find({ workspaceId: ws._id }).lean();
    expect(bookings).toHaveLength(0);
  });

  it("active Paddle subscription — cancelSubscription is called", async () => {
    await Workspace.create({
      _id: WS_A_ID,
      slug: "sarah-photo",
      name: "Sarah Photography",
      ownerUserId: OWNER_WORKOS_ID,
      businessType: "photographer",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      plan: "starter",
      paddleSubscriptionId: "sub_test_123",
      paddleSubscriptionStatus: "active",
    });

    const result = await deleteWorkspaceAction("sarah-photo");

    expect(result.ok).toBe(true);
    expect(cancelSubscription).toHaveBeenCalledWith("sub_test_123");
  });

  it("Paddle cancel throws — delete still succeeds (best-effort cancellation)", async () => {
    vi.mocked(cancelSubscription).mockRejectedValueOnce(
      new Error("Paddle API error"),
    );

    await Workspace.create({
      _id: WS_A_ID,
      slug: "sarah-photo",
      name: "Sarah Photography",
      ownerUserId: OWNER_WORKOS_ID,
      businessType: "photographer",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      plan: "pro",
      paddleSubscriptionId: "sub_test_456",
      paddleSubscriptionStatus: "active",
    });

    const result = await deleteWorkspaceAction("sarah-photo");

    expect(result.ok).toBe(true);
    const wsAfter = await Workspace.findById(WS_A_ID).lean();
    expect(wsAfter).toBeNull();
  });

  it("no active Paddle subscription — cancelSubscription is NOT called", async () => {
    await seedWorkspaceA();

    await deleteWorkspaceAction("sarah-photo");

    expect(cancelSubscription).not.toHaveBeenCalled();
  });
});

// ---- updateTimeFormatAction --------------------------------------------------

describe("updateTimeFormatAction", () => {
  it("updates timeFormat to 12h and sets cookie", async () => {
    await seedWorkspaceA();
    const mockCookieStore = { get: vi.fn(), set: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await updateTimeFormatAction("12h");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.timeFormat).toBe("12h");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "timeFormat",
      "12h",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("rejects invalid format value", async () => {
    await seedWorkspaceA();
    const result = await updateTimeFormatAction("invalid");
    expect(result.error).toBeDefined();
  });

  it("non-owner member can update their own time format", async () => {
    await seedWorkspaceA();
    await User.create({
      workosUserId: MEMBER_WORKOS_ID,
      email: "member@test.com",
      name: "Member User",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [{ workspaceId: WS_A_ID, role: "staff" }],
    });
    mockAuthAsMemberA();
    vi.mocked(getActiveWorkspaceId).mockResolvedValue(String(WS_A_ID));
    const mockCookieStore = { get: vi.fn(), set: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await updateTimeFormatAction("12h");
    expect(result.ok).toBe(true);

    const memberUser = await User.findOne({
      workosUserId: MEMBER_WORKOS_ID,
    }).lean();
    expect(memberUser?.timeFormat).toBe("12h");

    const ownerUser = await User.findOne({
      workosUserId: OWNER_WORKOS_ID,
    }).lean();
    expect(ownerUser?.timeFormat).toBe("24h");
  });
});

// ---- requestDataExportAction ------------------------------------------------

describe("requestDataExportAction", () => {
  it("sends email with 3 CSV attachments", async () => {
    await seedWorkspaceA();
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
    } as never);

    const result = await requestDataExportAction();
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledOnce();
    const call = vi.mocked(resend.emails.send).mock.calls[0][0];
    const filenames = (call.attachments ?? []).map((a: Attachment) =>
      String(a.filename ?? ""),
    );
    expect(filenames).toContain("bookings.csv");
    expect(filenames).toContain("clients.csv");
    expect(filenames).toContain("inquiries.csv");
  });

  it("returns error when Resend fails", async () => {
    await seedWorkspaceA();
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
    } as never);
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "bad sender" },
    } as never);

    const result = await requestDataExportAction();
    expect(result.error).toBeDefined();
  });
});

// ---- updateProfileNameAction ------------------------------------------------

describe("updateProfileNameAction", () => {
  it("updates name in WorkOS and syncs Mongo User doc", async () => {
    mockWorkos.userManagement.updateUser.mockResolvedValue({});

    const result = await updateProfileNameAction({ name: "Jane Doe" });
    expect(result.ok).toBe(true);

    expect(mockWorkos.userManagement.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_WORKOS_ID,
        firstName: "Jane",
        lastName: "Doe",
      }),
    );

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.name).toBe("Jane Doe");
  });

  it("rejects empty name", async () => {
    const result = await updateProfileNameAction({ name: "  " });
    expect(result.error).toBeTruthy();
    expect(mockWorkos.userManagement.updateUser).not.toHaveBeenCalled();
  });

  it("returns error if WorkOS updateUser throws", async () => {
    mockWorkos.userManagement.updateUser.mockRejectedValueOnce(
      new Error("WorkOS error"),
    );

    const result = await updateProfileNameAction({ name: "Valid Name" });
    expect(result.error).toBeTruthy();
  });

  it("unauthenticated user gets error", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const result = await updateProfileNameAction({ name: "Name" });
    expect(result.error).toBe("Not authenticated");
  });
});

// ---- enrollMfaAction --------------------------------------------------------

describe("enrollMfaAction", () => {
  it("returns qrCode and secret (no challengeId) and sets the httpOnly cookie", async () => {
    const mockCookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    mockWorkos.multiFactorAuth.createUserAuthFactor.mockResolvedValue({
      authenticationFactor: {
        id: "factor_123",
        type: "totp",
        totp: { qrCode: "data:image/png;base64,abc", secret: "MYSECRET" },
      },
      authenticationChallenge: { id: "challenge_456" },
    });

    const result = await enrollMfaAction();
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.qrCode).toBe("data:image/png;base64,abc");
      expect(result.secret).toBe("MYSECRET");
      // challengeId must NOT be in the returned result
      expect((result as Record<string, unknown>).challengeId).toBeUndefined();
    }

    // Cookie must have been set with the correct attributes
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "gw_mfa_enroll",
      JSON.stringify({ factorId: "factor_123", challengeId: "challenge_456" }),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      }),
    );
  });

  it("returns error if unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const result = await enrollMfaAction();
    expect("error" in result).toBe(true);
  });

  it("returns error if WorkOS throws", async () => {
    const mockCookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    mockWorkos.multiFactorAuth.createUserAuthFactor.mockRejectedValueOnce(
      new Error("WorkOS error"),
    );

    const result = await enrollMfaAction();
    expect("error" in result).toBe(true);
    // Cookie must NOT be set on failure
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});

// ---- verifyMfaEnrollmentAction ----------------------------------------------

describe("verifyMfaEnrollmentAction", () => {
  function makeCookieStore(cookieValue: string | undefined) {
    return {
      get: vi.fn().mockReturnValue(
        cookieValue !== undefined ? { value: cookieValue } : undefined,
      ),
      set: vi.fn(),
      delete: vi.fn(),
    };
  }

  const validCookie = JSON.stringify({
    factorId: "factor_123",
    challengeId: "challenge_456",
  });

  beforeEach(() => {
    // Default: factor belongs to the user
    mockWorkos.multiFactorAuth.listUserAuthFactors.mockResolvedValue({
      data: [{ id: "factor_123" }],
    });
    mockWorkos.multiFactorAuth.verifyChallenge.mockResolvedValue({
      valid: true,
      challenge: { id: "challenge_456" },
    });
  });

  it("reads challengeId from cookie — client cannot influence which challenge is verified", async () => {
    const mockCookieStore = makeCookieStore(validCookie);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    // Note: input has NO challengeId field — only code
    const result = await verifyMfaEnrollmentAction({ code: "123456" });
    expect(result.ok).toBe(true);

    // verifyChallenge must use the cookie's challengeId, not any client value
    expect(mockWorkos.multiFactorAuth.verifyChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ authenticationChallengeId: "challenge_456" }),
    );
  });

  it("valid code sets mfaEnabled=true on User and deletes the cookie", async () => {
    const mockCookieStore = makeCookieStore(validCookie);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await verifyMfaEnrollmentAction({ code: "123456" });
    expect(result.ok).toBe(true);

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.mfaEnabled).toBe(true);

    expect(mockCookieStore.delete).toHaveBeenCalledWith("gw_mfa_enroll");
  });

  it("rejects when the enrollment cookie is absent (expired or never started)", async () => {
    const mockCookieStore = makeCookieStore(undefined);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await verifyMfaEnrollmentAction({ code: "123456" });
    expect(result.error).toMatch(/expired/i);
    expect(mockWorkos.multiFactorAuth.verifyChallenge).not.toHaveBeenCalled();

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.mfaEnabled).toBe(false);
  });

  it("rejects when the cookie's factorId is not among the caller's own factors (defense in depth)", async () => {
    const cookieWithStrangerFactor = JSON.stringify({
      factorId: "factor_stranger",
      challengeId: "challenge_stranger",
    });
    const mockCookieStore = makeCookieStore(cookieWithStrangerFactor);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    // Caller owns factor_123, not factor_stranger
    mockWorkos.multiFactorAuth.listUserAuthFactors.mockResolvedValue({
      data: [{ id: "factor_123" }],
    });

    const result = await verifyMfaEnrollmentAction({ code: "123456" });
    expect(result.error).toBeTruthy();
    // verifyChallenge must NOT be called when the factor ownership check fails
    expect(mockWorkos.multiFactorAuth.verifyChallenge).not.toHaveBeenCalled();

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.mfaEnabled).toBe(false);
  });

  it("invalid code returns error without updating User", async () => {
    const mockCookieStore = makeCookieStore(validCookie);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    mockWorkos.multiFactorAuth.verifyChallenge.mockResolvedValue({
      valid: false,
      challenge: { id: "challenge_456" },
    });

    const result = await verifyMfaEnrollmentAction({ code: "000000" });
    expect(result.error).toBeTruthy();

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.mfaEnabled).toBe(false);
  });

  it("rejects non-6-digit code before touching WorkOS", async () => {
    const mockCookieStore = makeCookieStore(validCookie);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await verifyMfaEnrollmentAction({ code: "12345" });
    expect(result.error).toBeTruthy();
    expect(mockWorkos.multiFactorAuth.verifyChallenge).not.toHaveBeenCalled();
    expect(mockWorkos.multiFactorAuth.listUserAuthFactors).not.toHaveBeenCalled();
  });

  it("unauthenticated returns error", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const mockCookieStore = makeCookieStore(validCookie);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await verifyMfaEnrollmentAction({ code: "123456" });
    expect(result.error).toBe("Not authenticated");
  });
});

// ---- disableMfaAction -------------------------------------------------------

describe("disableMfaAction", () => {
  it("deletes all factors and sets mfaEnabled=false", async () => {
    await User.updateOne(
      { workosUserId: OWNER_WORKOS_ID },
      { $set: { mfaEnabled: true } },
    );

    mockWorkos.multiFactorAuth.listUserAuthFactors.mockResolvedValue({
      data: [{ id: "factor_111" }, { id: "factor_222" }],
    });
    mockWorkos.multiFactorAuth.deleteFactor.mockResolvedValue(undefined);

    const result = await disableMfaAction();
    expect(result.ok).toBe(true);

    expect(mockWorkos.multiFactorAuth.deleteFactor).toHaveBeenCalledTimes(2);
    expect(mockWorkos.multiFactorAuth.deleteFactor).toHaveBeenCalledWith("factor_111");
    expect(mockWorkos.multiFactorAuth.deleteFactor).toHaveBeenCalledWith("factor_222");

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.mfaEnabled).toBe(false);
  });

  it("unauthenticated returns error", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const result = await disableMfaAction();
    expect(result.error).toBe("Not authenticated");
  });

  it("cannot affect another user — userId comes only from getAuthUser()", async () => {
    // No userId parameter accepted; the action always uses the session userId.
    mockWorkos.multiFactorAuth.listUserAuthFactors.mockResolvedValue({
      data: [{ id: "factor_own" }],
    });
    mockWorkos.multiFactorAuth.deleteFactor.mockResolvedValue(undefined);

    await disableMfaAction();

    expect(mockWorkos.multiFactorAuth.listUserAuthFactors).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER_WORKOS_ID }),
    );
  });
});

// ---- setActiveWorkspaceAction -----------------------------------------------

describe("setActiveWorkspaceAction", () => {
  it("switches to a workspace the user is a member of", async () => {
    const wsB = await seedWorkspaceB();

    await User.updateOne(
      { workosUserId: OWNER_WORKOS_ID },
      {
        $set: {
          memberships: [
            { workspaceId: WS_A_ID, role: "owner" },
            { workspaceId: wsB._id, role: "staff" },
          ],
        },
      },
    );

    let threw = false;
    try {
      await setActiveWorkspaceAction(String(wsB._id));
    } catch (e) {
      threw = true;
      expect((e as Error).message).toMatch(/REDIRECT/);
    }
    expect(threw).toBe(true);
    expect(setActiveWorkspace).toHaveBeenCalledWith(OWNER_WORKOS_ID, String(wsB._id));
  });

  it("rejects workspaceId not in the user memberships (tenant isolation)", async () => {
    const strangerWs = await Workspace.create({
      slug: "stranger-ws",
      name: "Stranger WS",
      ownerUserId: "user_stranger",
      businessType: "other",
      country: "SG",
      currency: "SGD",
      timezone: "Asia/Singapore",
    });

    const result = await setActiveWorkspaceAction(String(strangerWs._id));
    expect(result.error).toBeTruthy();
    expect(setActiveWorkspace).not.toHaveBeenCalled();
  });

  it("unauthenticated returns error", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const result = await setActiveWorkspaceAction(String(WS_A_ID));
    expect(result.error).toBe("Not authenticated");
  });
});

// ---- updatePasswordAction ---------------------------------------------------

describe("updatePasswordAction", () => {
  const validInput = {
    currentPassword: "oldpassword",
    newPassword: "newpassword123",
    confirmPassword: "newpassword123",
  };

  it("verifies the current password then updates it", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockResolvedValue({
      user: { id: OWNER_WORKOS_ID },
    });
    mockWorkos.userManagement.updateUser.mockResolvedValue({});

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ ok: true });

    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@test.com", password: "oldpassword" }),
    );
    expect(mockWorkos.userManagement.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_WORKOS_ID,
        password: "newpassword123",
      }),
    );
  });

  it("returns 'incorrect' when current password is wrong", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(
      new AuthenticationException(
        401,
        { code: "invalid_credentials", message: "bad" } as never,
        "req_1",
      ),
    );

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ error: "Current password is incorrect." });
    expect(mockWorkos.userManagement.updateUser).not.toHaveBeenCalled();
  });

  it("treats an MFA-challenge exception as a correct password and proceeds", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(
      new AuthenticationException(
        401,
        { code: "mfa_challenge", message: "mfa" } as never,
        "req_2",
      ),
    );
    mockWorkos.userManagement.updateUser.mockResolvedValue({});

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ ok: true });
    expect(mockWorkos.userManagement.updateUser).toHaveBeenCalled();
  });

  it("rejects when new and confirm do not match", async () => {
    const result = await updatePasswordAction({
      ...validInput,
      confirmPassword: "different123",
    });
    expect(result).toEqual({ error: "Passwords do not match." });
    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).not.toHaveBeenCalled();
  });

  it("rejects a too-short new password", async () => {
    const result = await updatePasswordAction({
      currentPassword: "oldpassword",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect("error" in result).toBe(true);
    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).not.toHaveBeenCalled();
  });

  it("returns an error when rate limited", async () => {
    vi.mocked(checkAuthRateLimit).mockResolvedValueOnce({
      ok: false,
      retryAfterSec: 60,
    });
    const result = await updatePasswordAction(validInput);
    expect("error" in result).toBe(true);
    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ error: "Not authenticated" });
  });
});
