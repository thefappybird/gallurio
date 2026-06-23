import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authMiddlewareMock = vi.fn(async () => NextResponse.next());
const authkitMiddlewareMock = vi.fn(() => authMiddlewareMock);
const intlMiddlewareMock = vi.fn(() => NextResponse.next());

vi.mock("@workos-inc/authkit-nextjs", () => ({
  authkitMiddleware: authkitMiddlewareMock,
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => intlMiddlewareMock),
}));

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("runs AuthKit on public invite accept API routes", async () => {
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/api/invites/accept?token=test");

    await proxy(req);

    expect(authMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("does not run AuthKit on public localized pages", async () => {
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/en/sign-in");

    await proxy(req);

    expect(authMiddlewareMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("preserves original path+query as returnTo when redirecting unauthenticated users to sign-in", async () => {
    // Simulate authkitMiddleware signalling an unauthenticated request by
    // returning a redirect to /sign-in (which is what the real middleware does).
    authMiddlewareMock.mockResolvedValueOnce(
      NextResponse.redirect(new URL("http://localhost/sign-in"))
    );
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/bookings?detail=abc");

    const response = await proxy(req);

    expect(response).toBeDefined();
    const location = (response as Response).headers.get("location");
    expect(location).not.toBeNull();
    const redirected = new URL(location!);
    expect(redirected.pathname).toBe("/sign-in");
    expect(redirected.searchParams.get("returnTo")).toBe("/bookings?detail=abc");
  });
});
