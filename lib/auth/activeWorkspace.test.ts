import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User } from "@/lib/db/models";
import { Types } from "mongoose";

// ---------------------------------------------------------------------------
// Mock next/headers so we can control cookie values in tests
// ---------------------------------------------------------------------------

const cookieStore = new Map<string, string>();
let lastSetOptions: Record<string, unknown> | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v !== undefined ? { value: v } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieStore.set(name, value);
      lastSetOptions = options;
    },
    delete: (name: string) => { cookieStore.delete(name); },
  }),
}));

// Set the secret before importing the module under test.
process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "test-secret-do-not-use-in-prod";

// Dynamic import ensures the mock is registered first.
const { getActiveWorkspaceId, setActiveWorkspace, clearActiveWorkspace } =
  await import("./activeWorkspace");

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => {
  cookieStore.clear();
  await clearCollections();
});

function makeWsId() {
  return new Types.ObjectId();
}

// ---------------------------------------------------------------------------
// Cookie signing / tamper detection
// ---------------------------------------------------------------------------

describe("activeWorkspace — cookie signing", () => {
  it("getActiveWorkspaceId returns the workspace from a valid signed cookie", async () => {
    const wsId = makeWsId();
    const memberships = [{ workspaceId: wsId, role: "owner" as const }];

    // Write a valid cookie via setActiveWorkspace (signing path).
    await User.create({
      workosUserId: "user_sign_1",
      email: "sign1@example.com",
      memberships,
    });
    await setActiveWorkspace("user_sign_1", String(wsId));

    const resolved = await getActiveWorkspaceId(memberships);
    expect(resolved).toBe(String(wsId));
  });

  it("rejects a tampered cookie value (modified workspaceId)", async () => {
    // wsA is the real cookie workspace; wsC is NOT in memberships.
    // After tampering the cookie to point at wsC (with wsA's HMAC), the HMAC
    // check fails (wsC != wsA) and the cookie is rejected. The resolver then
    // falls back to the sole membership (wsA) — not the tampered wsC.
    const wsA = makeWsId();
    const wsC = makeWsId(); // not in memberships
    const memberships = [{ workspaceId: wsA, role: "owner" as const }];

    await User.create({
      workosUserId: "user_tamper_1",
      email: "tamper1@example.com",
      memberships,
    });

    // Write a valid signed cookie for wsA, then swap the workspaceId to wsC.
    await setActiveWorkspace("user_tamper_1", String(wsA));
    const raw = cookieStore.get("gw_active_ws")!;
    const dot = raw.lastIndexOf(".");
    const mac = raw.slice(dot); // wsA's HMAC
    cookieStore.set("gw_active_ws", `${String(wsC)}${mac}`); // payload swapped

    // Cookie is tampered: HMAC mismatch on wsC → rejected, falls back to wsA.
    const resolved = await getActiveWorkspaceId(memberships);
    expect(resolved).toBe(String(wsA));
  });

  it("rejects a cookie whose workspace is not in the caller-supplied memberships", async () => {
    const legitimate = makeWsId();
    const attacker = makeWsId();
    const memberships = [{ workspaceId: legitimate, role: "staff" as const }];

    await User.create({
      workosUserId: "user_notmember",
      email: "notmember@example.com",
      memberships,
    });

    // Forge a correctly-signed cookie for a workspace the user is NOT a member of.
    // We do this by calling setActiveWorkspace with a different user who IS a member,
    // but that's not possible here — instead, construct a signed value directly via
    // the same signing logic (white-box test).
    const { createHmac } = await import("crypto");
    const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET!;
    const mac = createHmac("sha256", secret).update(String(attacker)).digest("hex");
    cookieStore.set("gw_active_ws", `${String(attacker)}.${mac}`);

    const resolved = await getActiveWorkspaceId(memberships);
    // Must not resolve to the attacker workspace since user is not a member.
    expect(resolved).not.toBe(String(attacker));
    expect(resolved).toBe(String(legitimate));
  });
});

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

describe("activeWorkspace — fallback chain", () => {
  it("falls back to most-recent lastAccessedAt when no cookie is set", async () => {
    const older = makeWsId();
    const newer = makeWsId();
    const memberships = [
      { workspaceId: older, role: "staff" as const, lastAccessedAt: new Date(1000) },
      { workspaceId: newer, role: "owner" as const, lastAccessedAt: new Date(9000) },
    ];

    const resolved = await getActiveWorkspaceId(memberships);
    expect(resolved).toBe(String(newer));
  });

  it("falls back to sole membership when no cookie and no timestamps", async () => {
    const sole = makeWsId();
    const memberships = [{ workspaceId: sole, role: "owner" as const }];

    const resolved = await getActiveWorkspaceId(memberships);
    expect(resolved).toBe(String(sole));
  });

  it("returns null when memberships list is empty", async () => {
    const resolved = await getActiveWorkspaceId([]);
    expect(resolved).toBeNull();
  });

  it("returns null when no cookie and multiple memberships with no timestamps", async () => {
    const memberships = [
      { workspaceId: makeWsId(), role: "staff" as const },
      { workspaceId: makeWsId(), role: "staff" as const },
    ];
    const resolved = await getActiveWorkspaceId(memberships);
    expect(resolved).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearActiveWorkspace
// ---------------------------------------------------------------------------

describe("activeWorkspace — cookie scope (subdomain isolation)", () => {
  it("sets gw_active_ws as host-only (no domain attribute) so tenant subdomains never receive the session", async () => {
    const wsId = makeWsId();
    await User.create({
      workosUserId: "user_hostonly",
      email: "hostonly@example.com",
      memberships: [{ workspaceId: wsId, role: "owner" as const }],
    });

    await setActiveWorkspace("user_hostonly", String(wsId));

    expect(lastSetOptions).toBeDefined();
    expect(lastSetOptions?.domain).toBeUndefined();
  });
});

describe("activeWorkspace — clearActiveWorkspace", () => {
  it("removes the cookie", async () => {
    cookieStore.set("gw_active_ws", "some.value");
    await clearActiveWorkspace();
    expect(cookieStore.has("gw_active_ws")).toBe(false);
  });
});
