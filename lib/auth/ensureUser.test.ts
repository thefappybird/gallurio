import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User } from "@/lib/db/models";
import { ensureUser } from "./ensureUser";
import type { AuthUser } from "./session";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

const baseUser: AuthUser = {
  workosUserId: "user_wos_001",
  email: "alice@example.com",
  name: "Alice",
  avatarUrl: "https://example.com/avatar.png",
};

describe("ensureUser — JIT provisioning", () => {
  it("creates a new User document on first call", async () => {
    const user = await ensureUser(baseUser);
    expect(user.workosUserId).toBe("user_wos_001");
    expect(user.email).toBe("alice@example.com");
    expect(user.name).toBe("Alice");
    expect(user.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("is idempotent — calling twice returns the same document", async () => {
    await ensureUser(baseUser);
    await ensureUser(baseUser);
    const count = await User.countDocuments({ workosUserId: "user_wos_001" });
    expect(count).toBe(1);
  });

  it("syncs updated name and avatarUrl on subsequent calls", async () => {
    await ensureUser(baseUser);

    const updated: AuthUser = {
      ...baseUser,
      name: "Alice Updated",
      avatarUrl: "https://example.com/new-avatar.png",
    };
    const user = await ensureUser(updated);

    expect(user.name).toBe("Alice Updated");
    expect(user.avatarUrl).toBe("https://example.com/new-avatar.png");
  });

  it("preserves existing memberships when syncing profile fields", async () => {
    // Pre-create with a membership (simulating a previously provisioned user).
    const { Types } = await import("mongoose");
    const wsId = new Types.ObjectId();
    await User.create({
      workosUserId: "user_wos_001",
      email: "alice@example.com",
      name: "Alice",
      memberships: [{ workspaceId: wsId, role: "owner" }],
    });

    const user = await ensureUser({ ...baseUser, name: "Alice Renamed" });
    expect(user.name).toBe("Alice Renamed");
    expect(user.memberships).toHaveLength(1);
    expect(String(user.memberships[0].workspaceId)).toBe(String(wsId));
  });

  it("lowercases and trims email on upsert", async () => {
    const user = await ensureUser({ ...baseUser, email: "  ALICE@Example.COM  " });
    expect(user.email).toBe("alice@example.com");
  });

  it("stores null avatarUrl without error", async () => {
    const user = await ensureUser({ ...baseUser, workosUserId: "user_no_avatar", avatarUrl: null });
    expect(user.avatarUrl).toBeNull();
  });
});
