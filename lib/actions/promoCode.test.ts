import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { User, Workspace, PromoCode } from "@/lib/db/models";

vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth/activeWorkspace", () => ({
  getActiveWorkspaceId: vi.fn(),
}));

import { getAuthUser } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/auth/activeWorkspace";
import { redeemPromoCodeAction } from "./promoCode";

const mockGetAuthUser = getAuthUser as MockedFunction<typeof getAuthUser>;
const mockGetActiveWorkspaceId =
  getActiveWorkspaceId as MockedFunction<typeof getActiveWorkspaceId>;

const WOS_ID = "wos_promo_owner";

async function seedOwner(overrides: Record<string, unknown> = {}) {
  const ws = await Workspace.create({
    slug: "promo-ws",
    name: "Promo Workspace",
    ownerUserId: WOS_ID,
    plan: "free",
    ...overrides,
  });
  await User.create({
    workosUserId: WOS_ID,
    email: "promo-owner@example.com",
    name: "Promo Owner",
    memberships: [
      { workspaceId: ws._id, role: "owner", lastAccessedAt: new Date() },
    ],
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
  });
  mockGetAuthUser.mockResolvedValue({
    workosUserId: WOS_ID,
    email: "promo-owner@example.com",
    name: "Promo Owner",
    avatarUrl: null,
  } as never);
  mockGetActiveWorkspaceId.mockResolvedValue(ws._id.toString());
  return ws;
}

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

describe("redeemPromoCodeAction — valid redemption", () => {
  it("grants pro + no expiry for a lifetime code", async () => {
    const ws = await seedOwner();
    const promo = await PromoCode.create({
      title: "lifetime code",
      code: "lifetimecode1",
      type: "lifetime",
    });

    const result = await redeemPromoCodeAction("lifetimecode1");
    expect(result).toEqual({ ok: true, startsImmediately: true });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("pro");
    expect(updated?.planGrantExpiresAt).toBeNull();
    expect(updated?.codesRedeemed?.map(String)).toContain(String(promo._id));
  });

  it("grants pro + ~1 year expiry for a yearly code", async () => {
    const ws = await seedOwner();
    await PromoCode.create({
      title: "yearly code",
      code: "yearlycode1",
      type: "yearly",
    });

    const result = await redeemPromoCodeAction("yearlycode1");
    expect(result).toEqual({ ok: true, startsImmediately: true });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("pro");
    expect(updated?.planGrantExpiresAt).toBeTruthy();
  });

  it("grants pro + ~1 month expiry for a monthly code", async () => {
    const ws = await seedOwner();
    await PromoCode.create({
      title: "monthly code",
      code: "monthlycode1",
      type: "monthly",
    });

    const before = Date.now();
    const result = await redeemPromoCodeAction("monthlycode1");
    expect(result).toEqual({ ok: true, startsImmediately: true });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("pro");
    const expiresAt = updated?.planGrantExpiresAt as Date;
    expect(expiresAt).toBeTruthy();
    // Monthly grant should be well short of the yearly grant's ~365 days.
    const daysUntilExpiry = (expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeLessThan(32);
  });

  it("grants beta + no expiry for a beta code", async () => {
    const ws = await seedOwner();
    await PromoCode.create({
      title: "beta code",
      code: "betacode1",
      type: "beta",
    });

    const result = await redeemPromoCodeAction("betacode1");
    expect(result).toEqual({ ok: true, startsImmediately: true });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("beta");
    expect(updated?.planGrantExpiresAt).toBeNull();
  });
});

describe("redeemPromoCodeAction — startsImmediately contract", () => {
  it("returns startsImmediately: true for a lifetime code redemption", async () => {
    await seedOwner();
    await PromoCode.create({
      title: "lifetime code b",
      code: "lifetimecode2",
      type: "lifetime",
    });

    const result = await redeemPromoCodeAction("lifetimecode2");
    expect(result).toEqual({ ok: true, startsImmediately: true });
  });
});

describe("redeemPromoCodeAction — beta2mo", () => {
  it("returns not_eligible_beta_participant when the user never recorded beta participation", async () => {
    const ws = await seedOwner();
    await PromoCode.create({
      title: "beta2mo code",
      code: "beta2mocode1",
      type: "beta2mo",
    });

    const result = await redeemPromoCodeAction("beta2mocode1");
    expect(result).toEqual({ error: "not_eligible_beta_participant" });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("free");
  });
});

describe("redeemPromoCodeAction — invalid codes", () => {
  it("returns promo_code_not_found and does not mutate the workspace", async () => {
    const ws = await seedOwner();

    const result = await redeemPromoCodeAction("doesnotexist");
    expect(result).toEqual({ error: "promo_code_not_found" });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("free");
  });

  it("returns promo_code_expired and does not mutate the workspace", async () => {
    const ws = await seedOwner();
    await PromoCode.create({
      title: "expired code",
      code: "expiredcode1",
      type: "lifetime",
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await redeemPromoCodeAction("expiredcode1");
    expect(result).toEqual({ error: "promo_code_expired" });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("free");
  });

  it("returns promo_code_already_redeemed on a second redemption attempt", async () => {
    const ws = await seedOwner();
    const promo = await PromoCode.create({
      title: "one shot code",
      code: "oneshotcode1",
      type: "lifetime",
    });

    const first = await redeemPromoCodeAction("oneshotcode1");
    expect(first).toEqual({ ok: true, startsImmediately: true });

    const second = await redeemPromoCodeAction("oneshotcode1");
    expect(second).toEqual({ error: "promo_code_already_redeemed" });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.codesRedeemed?.map(String)).toEqual([String(promo._id)]);
  });

  it("does not re-extend planGrantExpiresAt on a sequential resubmit of an already-redeemed monthly code", async () => {
    const ws = await seedOwner();
    await PromoCode.create({
      title: "monthly resubmit code",
      code: "monthlyresubmit1",
      type: "monthly",
    });

    const first = await redeemPromoCodeAction("monthlyresubmit1");
    expect(first).toEqual({ ok: true, startsImmediately: true });
    const afterFirst = await Workspace.findById(ws._id).lean();
    const expiryAfterFirst = afterFirst?.planGrantExpiresAt?.getTime();

    const second = await redeemPromoCodeAction("monthlyresubmit1");
    expect(second).toEqual({ error: "promo_code_already_redeemed" });

    const afterSecond = await Workspace.findById(ws._id).lean();
    expect(afterSecond?.planGrantExpiresAt?.getTime()).toBe(expiryAfterFirst);
  });

  it("records exactly one redemption when two requests race on the same code", async () => {
    const ws = await seedOwner();
    const promo = await PromoCode.create({
      title: "race code",
      code: "racecode1",
      type: "lifetime",
    });

    const [first, second] = await Promise.all([
      redeemPromoCodeAction("racecode1"),
      redeemPromoCodeAction("racecode1"),
    ]);
    const results = [first, second];
    expect(results.filter((r) => "ok" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r)).toHaveLength(1);

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.codesRedeemed?.map(String)).toEqual([String(promo._id)]);
  });
});

describe("redeemPromoCodeAction — tenant isolation", () => {
  it("does not touch a different workspace's plan or codesRedeemed", async () => {
    const wsA = await seedOwner();
    const wsB = await Workspace.create({
      slug: "other-ws",
      name: "Other Workspace",
      ownerUserId: "wos_other_owner",
      plan: "free",
    });
    await PromoCode.create({
      title: "tenant code",
      code: "tenantcode1",
      type: "lifetime",
    });

    const result = await redeemPromoCodeAction("tenantcode1");
    expect(result).toEqual({ ok: true, startsImmediately: true });

    const untouchedB = await Workspace.findById(wsB._id).lean();
    expect(untouchedB?.plan).toBe("free");
    expect(untouchedB?.codesRedeemed).toEqual([]);

    const updatedA = await Workspace.findById(wsA._id).lean();
    expect(updatedA?.plan).toBe("pro");
  });
});

describe("redeemPromoCodeAction — case-insensitive input", () => {
  it("matches a stored lowercase code when submitted uppercase", async () => {
    const ws = await seedOwner();
    await PromoCode.create({
      title: "case code",
      code: "casecode1",
      type: "lifetime",
    });

    const result = await redeemPromoCodeAction("CASECODE1");
    expect(result).toEqual({ ok: true, startsImmediately: true });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("pro");
  });
});
