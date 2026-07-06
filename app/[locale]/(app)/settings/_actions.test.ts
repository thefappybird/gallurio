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
import { Workspace, User } from "@/lib/db/models";

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

vi.mock("@/lib/storage/cloudflareImages", () => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
  verifyImageOwnership: vi.fn().mockResolvedValue(true),
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
  updatePublicPageSettingsAction,
  togglePublicPagePublishedAction,
  updateTimeFormatAction,
  updateProfileNameAction,
  enrollMfaAction,
  verifyMfaEnrollmentAction,
  disableMfaAction,
  setActiveWorkspaceAction,
  updatePasswordAction,
  sendSetPasswordEmailAction,
  updateAvatarAction,
} from "./_actions";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";
import { cookies } from "next/headers";
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
    contactEmail: "",
    contactAddress: "",
    logoUrl: "",
    logoAssetId: "",
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

    expect(result.error).toBe("url_taken");

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

  it("maps E11000 duplicate-key race error to a friendly taken message (does not throw)", async () => {
    await seedWorkspaceA();

    // Simulate a race: the pre-write clash check passes (slug is free at check
    // time) but the unique index fires on the actual write.
    // We mock Workspace.updateOne to throw a synthetic E11000 error.
    const mongooseModule = await import("mongoose");
    const fakeE11000 = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
      name: "MongoServerError",
      keyPattern: { slug: 1 },
    });
    const updateOneSpy = vi.spyOn(Workspace, "updateOne").mockRejectedValueOnce(fakeE11000);

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      slug: "brand-new-slug", // no pre-existing clash, so pre-check passes
    });

    updateOneSpy.mockRestore();
    expect(result.error).toBe("url_taken");
    expect(mongooseModule).toBeDefined(); // sanity
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

    expect(result.error).toBe("owner_only");

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.name).toBe("Sarah Photography");
  });

  it("persists contact.email/contact.address/logoUrl/logoAssetId via dotted $set, leaves contact.phone/socials untouched", async () => {
    await seedWorkspaceA();
    await Workspace.updateOne(
      { _id: WS_A_ID },
      {
        $set: {
          "contact.phone": "+63 900 000 0000",
          "contact.socials.instagram": "https://instagram.com/sarah",
        },
      },
    );

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      contactEmail: "hello@sarah.com",
      contactAddress: "123 Manila St",
      logoUrl: "https://cdn.example.com/logo.png",
      logoAssetId: "logo_abc",
    });

    expect(result.ok).toBe(true);

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.contact?.email).toBe("hello@sarah.com");
    expect(ws?.contact?.address).toBe("123 Manila St");
    expect(ws?.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(ws?.logoAssetId).toBe("logo_abc");
    // Untouched siblings within contact subdoc.
    expect(ws?.contact?.phone).toBe("+63 900 000 0000");
    expect(ws?.contact?.socials?.instagram).toBe("https://instagram.com/sarah");
  });

  it("persists contact.addressLat/addressLng, defaulting to null when omitted", async () => {
    await seedWorkspaceA();

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      contactAddress: "123 Manila St",
      contactAddressLat: 14.5995,
      contactAddressLng: 120.9842,
    });

    expect(result.ok).toBe(true);
    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.contact?.addressLat).toBe(14.5995);
    expect(ws?.contact?.addressLng).toBe(120.9842);

    const cleared = await updateWorkspaceBusinessAction({ ...validInput, contactAddress: "" });
    expect(cleared.ok).toBe(true);
    const wsCleared = await Workspace.findById(WS_A_ID).lean();
    expect(wsCleared?.contact?.addressLat).toBeNull();
    expect(wsCleared?.contact?.addressLng).toBeNull();
  });

  it("rejects logoAssetId when ownership verification fails", async () => {
    await seedWorkspaceA();
    vi.mocked(verifyImageOwnership).mockResolvedValueOnce(false);

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      logoUrl: "https://cdn.example.com/notmine.png",
      logoAssetId: "logo_notmine",
    });

    expect(result.error).toBe("invalid_logo");
    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.logoAssetId ?? "").toBe("");
  });

  it("deletes the old logo asset when replaced with a new one", async () => {
    await seedWorkspaceA();
    await Workspace.updateOne(
      { _id: WS_A_ID },
      { $set: { logoAssetId: "old_logo_id", logoUrl: "https://cdn.example.com/old.png" } },
    );

    vi.mocked(verifyImageOwnership).mockResolvedValueOnce(true);
    vi.mocked(deleteImage).mockResolvedValue(undefined);

    const result = await updateWorkspaceBusinessAction({
      ...validInput,
      logoUrl: "https://cdn.example.com/new.png",
      logoAssetId: "new_logo_id",
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(deleteImage)).toHaveBeenCalledWith("old_logo_id");
  });
});

// ---- updatePublicPageSettingsAction -----------------------------------------

describe("updatePublicPageSettingsAction — seo fields", () => {
  it("persists seo.galleryDescription to the workspace doc", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      seo: { galleryDescription: "A curated gallery of wedding photography." },
    });

    expect(result.ok).toBe(true);

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.publicPage?.seo?.galleryDescription).toBe(
      "A curated gallery of wedding photography.",
    );
  });

  it("persists seo.noindex toggle", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      seo: { noindex: true },
    });

    expect(result.ok).toBe(true);

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.publicPage?.seo?.noindex).toBe(true);
  });

  it("rejects seo.ogImageAssetId when ownership fails", async () => {
    await seedWorkspaceA();

    vi.mocked(verifyImageOwnership).mockResolvedValueOnce(false);

    const result = await updatePublicPageSettingsAction({
      seo: {
        ogImageUrl: "https://cdn.example.com/og.jpg",
        ogImageAssetId: "og_notmine",
      },
    });

    expect(result.error).toBe("invalid_og_image");
  });

  it("galleryDescription > 160 chars is rejected", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      seo: { galleryDescription: "x".repeat(161) },
    });

    expect(result.error).toBeTruthy();
  });

  it("owner-only — non-owner cannot update seo fields", async () => {
    await seedWorkspaceA();

    await User.create({
      workosUserId: "user_seo_staff",
      email: "seostaff@test.com",
      name: "SEO Staff",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [{ workspaceId: WS_A_ID, role: "staff" }],
    });

    mockGetAuthUser.mockResolvedValue({
      workosUserId: "user_seo_staff",
      email: "seostaff@test.com",
      name: "SEO Staff",
      avatarUrl: null,
    });

    const result = await updatePublicPageSettingsAction({
      seo: { galleryDescription: "Hacked description" },
    });

    expect(result.error).toBe("owner_only");
  });

  it("tenant isolation — workspace B seo is NOT touched", async () => {
    await seedWorkspaceA();
    await seedWorkspaceB();

    const result = await updatePublicPageSettingsAction({
      seo: { galleryDescription: "WS_A gallery" },
    });

    expect(result.ok).toBe(true);

    const wsB = await Workspace.findById(WS_B_ID).lean();
    expect(wsB?.publicPage?.seo?.galleryDescription ?? "").toBe("");
  });

  it("persists seo.ogImageUrl and ogImageAssetId when ownership verified", async () => {
    await seedWorkspaceA();

    vi.mocked(verifyImageOwnership).mockResolvedValueOnce(true);

    const result = await updatePublicPageSettingsAction({
      seo: {
        ogImageUrl: "https://cdn.example.com/og.jpg",
        ogImageAssetId: "og_abc",
      },
    });

    expect(result.ok).toBe(true);

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.publicPage?.seo?.ogImageUrl).toBe("https://cdn.example.com/og.jpg");
    expect(ws?.publicPage?.seo?.ogImageAssetId).toBe("og_abc");
  });

  it("deletes old OG image when replacing with new one", async () => {
    await seedWorkspaceA();

    await Workspace.updateOne(
      { _id: WS_A_ID },
      { $set: { "publicPage.seo.ogImageAssetId": "old_og_id" } },
    );

    vi.mocked(verifyImageOwnership).mockResolvedValueOnce(true);
    vi.mocked(deleteImage).mockResolvedValue(undefined);

    const result = await updatePublicPageSettingsAction({
      seo: {
        ogImageUrl: "https://cdn.example.com/new-og.jpg",
        ogImageAssetId: "new_og_id",
      },
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(deleteImage)).toHaveBeenCalledWith("old_og_id");
  });
});

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

  it("persists siteIconUrl and siteIconAssetId", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      siteIconUrl: "https://cdn.example.com/icon.png",
      siteIconAssetId: "abc123",
    });

    expect(result.ok).toBe(true);

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.publicPage?.siteIcon?.url).toBe("https://cdn.example.com/icon.png");
    expect(ws?.publicPage?.siteIcon?.assetId).toBe("abc123");
  });

  it("rejects invalid siteIconUrl (non-URL non-empty string)", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      siteIconUrl: "not-a-url",
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
    expect(result.error).toBe("not_authenticated");
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
      // expiresAt lets the client run a countdown and offer a refresh
      expect(typeof result.expiresAt).toBe("number");
      expect(result.expiresAt).toBeGreaterThan(Date.now());
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

  it("does not gate verification on listUserAuthFactors — a pending factor is not yet listed", async () => {
    // Regression guard: a prior listUserAuthFactors ownership check rejected
    // every legitimate enrollment because WorkOS does not list a factor as
    // owned until it is verified. The cookie (server-set, httpOnly) is the
    // binding, so verify must succeed without consulting the factor list.
    const mockCookieStore = makeCookieStore(validCookie);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    const result = await verifyMfaEnrollmentAction({ code: "123456" });
    expect(result.ok).toBe(true);
    expect(
      mockWorkos.multiFactorAuth.listUserAuthFactors,
    ).not.toHaveBeenCalled();
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
    expect(result.error).toBe("not_authenticated");
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
    expect(result.error).toBe("not_authenticated");
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
    expect(result.error).toBe("not_authenticated");
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
    expect(result).toEqual({ error: "current_password_incorrect" });
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

  it("treats a radar_email_challenge exception as a correct password and proceeds", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(
      new AuthenticationException(
        401,
        { code: "radar_email_challenge", message: "radar" } as never,
        "req_3",
      ),
    );
    mockWorkos.userManagement.updateUser.mockResolvedValue({});

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ ok: true });
    expect(mockWorkos.userManagement.updateUser).toHaveBeenCalled();
  });

  it("treats an sso_required exception as a wrong password (not in PASSWORD_OK_CODES)", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(
      new AuthenticationException(
        401,
        { code: "sso_required", message: "sso" } as never,
        "req_4",
      ),
    );

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ error: "current_password_incorrect" });
    expect(mockWorkos.userManagement.updateUser).not.toHaveBeenCalled();
  });

  it("rejects when new and confirm do not match", async () => {
    const result = await updatePasswordAction({
      ...validInput,
      confirmPassword: "different123",
    });
    expect(result).toEqual({ error: "passwords_mismatch" });
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
    expect(result).toEqual({ error: expect.stringContaining("8") });
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
    expect(result).toEqual({ error: "not_authenticated" });
  });
});

// ---- sendSetPasswordEmailAction ---------------------------------------------

describe("sendSetPasswordEmailAction", () => {
  it("creates a reset token and emails the link to the user", async () => {
    mockWorkos.userManagement.createPasswordReset.mockResolvedValue({
      passwordResetToken: "tok_xyz",
      passwordResetUrl: "https://workos/x",
    });

    const result = await sendSetPasswordEmailAction();
    expect(result).toEqual({ ok: true });

    expect(
      mockWorkos.userManagement.createPasswordReset,
    ).toHaveBeenCalledWith({ email: "owner@test.com" });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "owner@test.com",
      "tok_xyz",
    );
  });

  it("returns an error when rate limited", async () => {
    vi.mocked(checkAuthRateLimit).mockResolvedValueOnce({
      ok: false,
      retryAfterSec: 60,
    });
    const result = await sendSetPasswordEmailAction();
    expect("error" in result).toBe(true);
    expect(
      mockWorkos.userManagement.createPasswordReset,
    ).not.toHaveBeenCalled();
  });

  it("returns an error when WorkOS createPasswordReset throws", async () => {
    mockWorkos.userManagement.createPasswordReset.mockRejectedValueOnce(
      new Error("workos down"),
    );
    const result = await sendSetPasswordEmailAction();
    expect("error" in result).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await sendSetPasswordEmailAction();
    expect(result).toEqual({ error: "not_authenticated" });
  });
});

// ---- updateAvatarAction -----------------------------------------------------

const { deleteImage, verifyImageOwnership } = await import("@/lib/storage/cloudflareImages");

describe("updateAvatarAction", () => {
  const NEW_URL = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
  const NEW_PUBLIC_ID = "gallurio/ws_abc/avatars/sample";
  const OLD_PUBLIC_ID = "gallurio/ws_abc/avatars/old";

  it("sets avatarUrl and avatarAssetId on the User doc", async () => {
    const result = await updateAvatarAction({
      avatarUrl: NEW_URL,
      avatarAssetId: NEW_PUBLIC_ID,
    });

    expect(result.ok).toBe(true);

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.avatarUrl).toBe(NEW_URL);
    expect(user?.avatarAssetId).toBe(NEW_PUBLIC_ID);
  });

  it("calls deleteImage with the previous publicId when replacing", async () => {
    // Seed user with an existing avatar
    await User.updateOne(
      { workosUserId: OWNER_WORKOS_ID },
      { $set: { avatarUrl: "https://old.example.com/a.jpg", avatarAssetId: OLD_PUBLIC_ID } },
    );

    vi.mocked(deleteImage).mockResolvedValue(undefined);

    const result = await updateAvatarAction({
      avatarUrl: NEW_URL,
      avatarAssetId: NEW_PUBLIC_ID,
    });

    expect(result.ok).toBe(true);
    expect(deleteImage).toHaveBeenCalledWith(OLD_PUBLIC_ID);
  });

  it("calls deleteImage when removing the avatar (both null)", async () => {
    await User.updateOne(
      { workosUserId: OWNER_WORKOS_ID },
      { $set: { avatarUrl: "https://old.example.com/a.jpg", avatarAssetId: OLD_PUBLIC_ID } },
    );

    vi.mocked(deleteImage).mockResolvedValue(undefined);

    const result = await updateAvatarAction({
      avatarUrl: null,
      avatarAssetId: null,
    });

    expect(result.ok).toBe(true);
    expect(deleteImage).toHaveBeenCalledWith(OLD_PUBLIC_ID);

    const user = await User.findOne({ workosUserId: OWNER_WORKOS_ID }).lean();
    expect(user?.avatarUrl).toBeNull();
    expect(user?.avatarAssetId).toBeNull();
  });

  it("does NOT call deleteImage when there was no previous publicId", async () => {
    vi.mocked(deleteImage).mockResolvedValue(undefined);

    const result = await updateAvatarAction({
      avatarUrl: NEW_URL,
      avatarAssetId: NEW_PUBLIC_ID,
    });

    expect(result.ok).toBe(true);
    expect(deleteImage).not.toHaveBeenCalled();
  });

  it("returns error for a non-https avatarUrl", async () => {
    const result = await updateAvatarAction({
      avatarUrl: "http://insecure.example.com/a.jpg",
      avatarAssetId: null,
    });

    expect(result.error).toBeTruthy();
  });

  it("returns error for an invalid avatarUrl", async () => {
    const result = await updateAvatarAction({
      avatarUrl: "not-a-url",
      avatarAssetId: null,
    });

    expect(result.error).toBeTruthy();
  });

  it("returns Not authenticated when no session", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const result = await updateAvatarAction({
      avatarUrl: null,
      avatarAssetId: null,
    });

    expect(result).toEqual({ error: "not_authenticated" });
  });
});

// ---- updatePublicPageSettingsAction — seo extended --------------------------

const { verifyImageOwnership: verifyOwnership } = await import(
  "@/lib/storage/cloudflareImages"
);

describe("updatePublicPageSettingsAction — seo extended", () => {
  it("rejects galleryDescription longer than 160 chars", async () => {
    await seedWorkspaceA();

    const result = await updatePublicPageSettingsAction({
      seo: { galleryDescription: "x".repeat(161) },
    });

    expect(result.error).toBeTruthy();
  });

  it("rejects OG image when verifyImageOwnership returns false", async () => {
    await seedWorkspaceA();
    vi.mocked(verifyOwnership).mockResolvedValueOnce(false);

    const result = await updatePublicPageSettingsAction({
      seo: {
        ogImageUrl: "https://imagedelivery.net/h/og123/public",
        ogImageAssetId: "og123",
      },
    });

    expect(result.error).toBeTruthy();

    const ws = await Workspace.findById(WS_A_ID).lean();
    expect(ws?.publicPage?.seo?.ogImageAssetId ?? "").toBe("");
  });

  it("deletes old OG image when a new one replaces it", async () => {
    const OLD_OG = "og_old_456";
    await seedWorkspaceA();
    await Workspace.updateOne(
      { _id: WS_A_ID },
      {
        $set: {
          "publicPage.seo.ogImageUrl": "https://old.example.com/og.jpg",
          "publicPage.seo.ogImageAssetId": OLD_OG,
        },
      },
    );

    vi.mocked(verifyOwnership).mockResolvedValueOnce(true);
    const { deleteImage: del } = await import("@/lib/storage/cloudflareImages");

    const result = await updatePublicPageSettingsAction({
      seo: {
        ogImageUrl: "https://imagedelivery.net/h/og_new/public",
        ogImageAssetId: "og_new",
      },
    });

    expect(result.ok).toBe(true);
    expect(del).toHaveBeenCalledWith(OLD_OG);
  });

  it("tenant isolation — workspace B seo is not affected", async () => {
    await seedWorkspaceA();
    await seedWorkspaceB();

    await updatePublicPageSettingsAction({
      seo: { galleryDescription: "Only for workspace A." },
    });

    const wsB = await Workspace.findById(WS_B_ID).lean();
    expect(wsB?.publicPage?.seo?.galleryDescription ?? "").toBe("");
  });
});
