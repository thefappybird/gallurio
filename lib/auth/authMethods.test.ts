import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUserIdentities } = vi.hoisted(() => ({
  mockGetUserIdentities: vi.fn(),
}));
vi.mock("@/lib/workos", () => ({
  workos: { userManagement: { getUserIdentities: mockGetUserIdentities } },
}));

import { getAuthMethods } from "./authMethods";

beforeEach(() => vi.clearAllMocks());

describe("getAuthMethods", () => {
  it("reports hasOAuth=false when the user has no identities (password user)", async () => {
    mockGetUserIdentities.mockResolvedValue([]);
    const result = await getAuthMethods("user_1");
    expect(result).toEqual({ hasOAuth: false, oauthProviders: [] });
  });

  it("reports hasOAuth=true and lists providers for an OAuth user", async () => {
    mockGetUserIdentities.mockResolvedValue([
      { idpId: "g1", type: "OAuth", provider: "GoogleOAuth" },
    ]);
    const result = await getAuthMethods("user_2");
    expect(result.hasOAuth).toBe(true);
    expect(result.oauthProviders).toEqual(["GoogleOAuth"]);
  });

  it("defaults to hasOAuth=false when the WorkOS call throws", async () => {
    mockGetUserIdentities.mockRejectedValue(new Error("network"));
    const result = await getAuthMethods("user_3");
    expect(result).toEqual({ hasOAuth: false, oauthProviders: [] });
  });
});
