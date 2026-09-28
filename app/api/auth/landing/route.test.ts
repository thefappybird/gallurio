import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User } from "@/lib/db/models";

const getAuthUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUserMock(),
}));

import { GET } from "./route";

function landingReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/auth/landing${query}`);
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
});

function authUser(workosUserId = "wu_1") {
  return { workosUserId, email: "a@b.com", name: "A B", avatarUrl: null };
}

describe("GET /api/auth/landing", () => {
  it("redirects an anonymous visitor to /sign-in, not back to /", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const res = (await GET(landingReq())) as Response;

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("no-store cache-control on every response", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const res = (await GET(landingReq())) as Response;
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("sends an onboarded owner to /dashboard", async () => {
    getAuthUserMock.mockResolvedValue(authUser());
    await User.create({
      workosUserId: "wu_1",
      email: "a@b.com",
      memberships: [{ workspaceId: new Types.ObjectId(), role: "owner" }],
      onboardingCompletedAt: new Date(),
    });

    const res = (await GET(landingReq())) as Response;

    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("sends a not-yet-onboarded owner to /onboarding", async () => {
    getAuthUserMock.mockResolvedValue(authUser());
    await User.create({
      workosUserId: "wu_1",
      email: "a@b.com",
      memberships: [{ workspaceId: new Types.ObjectId(), role: "owner" }],
      onboardingCompletedAt: null,
    });

    const res = (await GET(landingReq())) as Response;

    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
  });

  it("sends staff to /bookings", async () => {
    getAuthUserMock.mockResolvedValue(authUser());
    await User.create({
      workosUserId: "wu_1",
      email: "a@b.com",
      memberships: [{ workspaceId: new Types.ObjectId(), role: "staff" }],
      onboardingCompletedAt: new Date(),
    });

    const res = (await GET(landingReq())) as Response;

    expect(new URL(res.headers.get("location")!).pathname).toBe("/bookings");
  });

  it("sends a signed-in user with no User doc to /onboarding", async () => {
    getAuthUserMock.mockResolvedValue(authUser("wu_ghost"));

    const res = (await GET(landingReq())) as Response;

    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
  });

  it("localizes the redirect for a non-default locale", async () => {
    getAuthUserMock.mockResolvedValue(authUser());
    await User.create({
      workosUserId: "wu_1",
      email: "a@b.com",
      memberships: [{ workspaceId: new Types.ObjectId(), role: "owner" }],
      onboardingCompletedAt: new Date(),
    });

    const res = (await GET(landingReq("?locale=fil"))) as Response;

    expect(new URL(res.headers.get("location")!).pathname).toBe("/fil/dashboard");
  });

  it("falls back to the default locale for an invalid locale value", async () => {
    getAuthUserMock.mockResolvedValue(authUser());
    await User.create({
      workosUserId: "wu_1",
      email: "a@b.com",
      memberships: [{ workspaceId: new Types.ObjectId(), role: "owner" }],
      onboardingCompletedAt: new Date(),
    });

    const res = (await GET(landingReq("?locale=zz"))) as Response;

    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });
});
