import { describe, expect, it, vi, beforeEach } from "vitest";

const withAuthMock = vi.fn();
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: withAuthMock,
}));

const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: headersMock,
}));

async function load() {
  return import("./session");
}

describe("getAuthUser", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    headersMock.mockReset();
  });

  it("returns null without calling withAuth() when the AuthKit middleware header is absent", async () => {
    headersMock.mockResolvedValue(new Headers());
    const { getAuthUser } = await load();

    const result = await getAuthUser();

    expect(result).toBeNull();
    expect(withAuthMock).not.toHaveBeenCalled();
  });

  it("returns null when the middleware header is present but there is no user", async () => {
    const h = new Headers();
    h.set("x-workos-middleware", "true");
    headersMock.mockResolvedValue(h);
    withAuthMock.mockResolvedValue({ user: null });
    const { getAuthUser } = await load();

    const result = await getAuthUser();

    expect(result).toBeNull();
    expect(withAuthMock).toHaveBeenCalled();
  });

  it("maps the WorkOS user to AuthUser when the middleware header is present", async () => {
    const h = new Headers();
    h.set("x-workos-middleware", "true");
    headersMock.mockResolvedValue(h);
    withAuthMock.mockResolvedValue({
      user: {
        id: "user_123",
        email: "a@b.com",
        firstName: "Jane",
        lastName: "Doe",
        profilePictureUrl: "https://example.com/a.png",
      },
    });
    const { getAuthUser } = await load();

    const result = await getAuthUser();

    expect(result).toEqual({
      workosUserId: "user_123",
      email: "a@b.com",
      name: "Jane Doe",
      avatarUrl: "https://example.com/a.png",
    });
  });
});
