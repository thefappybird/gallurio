/**
 * Tests for SettingsCatchallPage — gating logic only.
 *
 * The page is a Server Component with many heavy imports (form panels,
 * Cloudinary, Lucide icons, etc.). We mock every external module so the
 * file can be imported, then call the default export directly as an async
 * function and assert whether notFound() is thrown.
 *
 * We do NOT render through React — the gating logic runs before any JSX is
 * evaluated, so this approach exercises exactly what we need.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Sentinel error thrown by our notFound() stub — lets us distinguish a
// genuine notFound() call from any other failure.
// ---------------------------------------------------------------------------
class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the modules they mock.
// ---------------------------------------------------------------------------

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
  saveSession: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new NotFoundError();
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/i18n/routing", () => ({
  routing: { defaultLocale: "en" },
}));

// Stub all heavy component imports so the page module can load cleanly.
vi.mock("../_components/settings-user-profile", () => ({
  SettingsUserProfile: () => null,
}));
vi.mock("../workspace/_business-form", () => ({
  WorkspaceBusinessForm: () => null,
}));
vi.mock("../workspace/_branding-form", () => ({
  WorkspaceBrandingForm: () => null,
}));
vi.mock("../customize/_panel", () => ({
  CustomizePanel: () => null,
}));
vi.mock("../public-page/_form", () => ({
  PublicPageSettingsForm: () => null,
}));
vi.mock("../danger/_panel", () => ({
  DangerPanel: () => null,
}));
vi.mock("../dev-plan/_panel", () => ({
  DevPlanPanel: () => null,
}));
vi.mock("../account/_panel", () => ({
  AccountPanel: () => null,
}));
vi.mock("../security/_panel", () => ({
  SecurityPanel: () => null,
}));
vi.mock("../billing/_panel", () => ({
  BillingPanel: () => null,
}));

// Stub Lucide icons — they are just React components and would need a DOM.
vi.mock("lucide-react", () => ({
  Building2: () => null,
  Palette: () => null,
  Globe: () => null,
  AlertTriangle: () => null,
  Wrench: () => null,
  CreditCard: () => null,
  UserIcon: () => null,
  ShieldIcon: () => null,
}));

// ---------------------------------------------------------------------------
// requireOrg mock — mutable so individual tests can override role.
// ---------------------------------------------------------------------------
const requireOrgMock = vi.fn();

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: (...args: unknown[]) => requireOrgMock(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn().mockResolvedValue({
    workosUserId: "user_owner",
    email: "owner@test.com",
    name: "Owner User",
    avatarUrl: null,
  }),
}));

vi.mock("@/lib/auth/activeWorkspace", () => ({
  getActiveWorkspaceId: vi.fn().mockResolvedValue("ws_1"),
  setActiveWorkspace: vi.fn().mockResolvedValue(undefined),
  clearActiveWorkspace: vi.fn().mockResolvedValue(undefined),
}));

// Stub User and Workspace Mongoose queries used by the page to load member workspaces.
vi.mock("@/lib/db/models", () => ({
  User: {
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        workosUserId: "user_owner",
        mfaEnabled: false,
        memberships: [{ workspaceId: "ws_1", role: "owner" }],
      }),
    }),
  },
  Workspace: {
    find: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: "ws_1", name: "Sarah Photography", branding: null },
      ]),
    }),
  },
}));

// ---------------------------------------------------------------------------
// getAuthMethods mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth/authMethods", () => ({
  getAuthMethods: vi.fn().mockResolvedValue({ hasOAuth: false, oauthProviders: [] }),
}));

// ---------------------------------------------------------------------------
// getUserTimeFormat mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/utils/get-user-time-format", () => ({
  getUserTimeFormat: vi.fn().mockResolvedValue("24h"),
}));

// ---------------------------------------------------------------------------
// Workspace stub shared across tests
// ---------------------------------------------------------------------------
const WORKSPACE_STUB = {
  _id: "ws_1",
  name: "Sarah Photography",
  slug: "sarah-photo",
  businessType: "photographer",
  country: "PH",
  currency: "PHP",
  timezone: "Asia/Manila",
  plan: "starter",
  ownerUserId: "user_owner",
  branding: null,
  publicPage: null,
};

function mockAsOwner() {
  requireOrgMock.mockResolvedValue({
    userId: "user_owner",
    workspaceId: "ws_1",
    role: "owner",
    workspace: WORKSPACE_STUB,
  });
}

function mockAsStaff() {
  requireOrgMock.mockResolvedValue({
    userId: "user_staff",
    workspaceId: "ws_1",
    role: "staff",
    workspace: WORKSPACE_STUB,
  });
}

// ---------------------------------------------------------------------------
// Helper: build params Promise matching Next 16's async params shape.
// ---------------------------------------------------------------------------
function makeParams(catchall?: string[]) {
  return Promise.resolve({ locale: "en", catchall });
}

// ---------------------------------------------------------------------------
// Lazy-import the page after mocks are registered.
// ---------------------------------------------------------------------------
async function loadPage() {
  // Use a cache-busted dynamic import so re-imports across tests get the same
  // module (vi.mock hoisting guarantees mocks are in place).
  const mod = await import("./page");
  return mod.default;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsCatchallPage — owner-only slug gating", () => {
  it("staff + catchall=['workspace'] → notFound() is called", async () => {
    mockAsStaff();
    const Page = await loadPage();

    await expect(Page({ params: makeParams(["workspace"]) })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("staff + catchall=['public-page'] → notFound() is called", async () => {
    mockAsStaff();
    const Page = await loadPage();

    await expect(Page({ params: makeParams(["public-page"]) })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("staff + catchall=['danger'] → notFound() is called", async () => {
    mockAsStaff();
    const Page = await loadPage();

    await expect(Page({ params: makeParams(["danger"]) })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("staff + catchall=['dev-plan'] → notFound() is called", async () => {
    mockAsStaff();
    const Page = await loadPage();

    await expect(Page({ params: makeParams(["dev-plan"]) })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("owner + catchall=['workspace'] → notFound() is NOT called (renders)", async () => {
    mockAsOwner();
    const Page = await loadPage();

    // Should resolve without throwing NotFoundError.
    await expect(Page({ params: makeParams(["workspace"]) })).resolves.not.toThrow();
  });

  it("staff + catchall=undefined (base /settings) → notFound() is NOT called (account tab)", async () => {
    mockAsStaff();
    const Page = await loadPage();

    await expect(Page({ params: makeParams(undefined) })).resolves.not.toThrow();
  });

  it("staff + catchall=[] (empty array) → notFound() is NOT called", async () => {
    mockAsStaff();
    const Page = await loadPage();

    await expect(Page({ params: makeParams([]) })).resolves.not.toThrow();
  });

  it("staff + catchall=['customize'] → notFound() is NOT called (customize is member-accessible)", async () => {
    mockAsStaff();
    const Page = await loadPage();

    await expect(Page({ params: makeParams(["customize"]) })).resolves.not.toThrow();
  });
});
