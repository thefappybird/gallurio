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

  it("routes the marketing root (any locale) through AuthKit so the landing page can read the session", async () => {
    const { proxy } = await import("./proxy");
    for (const url of ["http://localhost/", "http://localhost/en", "http://localhost/ar"]) {
      authMiddlewareMock.mockClear();
      intlMiddlewareMock.mockClear();
      await proxy(new NextRequest(url));
      // AuthKit must run so withAuth() works in the page; intl runs after for
      // locale routing. The mock returns next() (not a redirect), so anonymous
      // visitors are NOT bounced to sign-in — the root stays public.
      expect(authMiddlewareMock, `authkit on ${url}`).toHaveBeenCalledTimes(1);
      expect(intlMiddlewareMock, `intl on ${url}`).toHaveBeenCalledTimes(1);
    }
  });

  it("does not run AuthKit on public localized pages", async () => {
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/en/sign-in");

    await proxy(req);

    expect(authMiddlewareMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("preserves original path+query as returnTo when redirecting unauthenticated users to sign-in (local /sign-in redirect)", async () => {
    // Simulate authkitMiddleware signalling an unauthenticated request by
    // returning a redirect to /sign-in (mock/test environments).
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

  it("preserves original path+query as returnTo when authkitMiddleware redirects to the hosted WorkOS auth endpoint", async () => {
    // In real usage, authkitMiddleware calls workos.userManagement.getAuthorizationUrl
    // and returns a redirect to the WorkOS authorization endpoint (api.workos.com),
    // not the local /sign-in. This case was not handled before — verify it is now.
    authMiddlewareMock.mockResolvedValueOnce(
      NextResponse.redirect(
        new URL("https://api.workos.com/user_management/authorize?client_id=test&state=xyz")
      )
    );
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/inquiries?inquiryId=abc123");

    const response = await proxy(req);

    expect(response).toBeDefined();
    const location = (response as Response).headers.get("location");
    expect(location).not.toBeNull();
    const redirected = new URL(location!);
    // Should redirect to the local sign-in page, not to authkit.app
    expect(redirected.pathname).toBe("/sign-in");
    expect(redirected.searchParams.get("returnTo")).toBe("/inquiries?inquiryId=abc123");
  });

  it("unions both middlewares' request-header manifests so the locale header survives on protected routes", async () => {
    // next-intl injects `x-next-intl-locale` via the override-headers manifest;
    // authkit injects its session header the same way. A blind copy would drop
    // next-intl's manifest, making hard-reloaded /{locale}/* pages fall back to
    // the default locale. The merge must keep BOTH names + authkit's set-cookie.
    intlMiddlewareMock.mockImplementationOnce(() => {
      const res = NextResponse.next();
      res.headers.set("x-middleware-override-headers", "x-next-intl-locale");
      res.headers.set("x-middleware-request-x-next-intl-locale", "ar");
      return res;
    });
    authMiddlewareMock.mockResolvedValueOnce(
      (() => {
        const res = NextResponse.next();
        res.headers.set("x-middleware-override-headers", "x-workos-session");
        res.headers.set("x-middleware-request-x-workos-session", "tok");
        res.headers.set("set-cookie", "wos-session=abc; Path=/");
        return res;
      })(),
    );

    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/ar/bookings");
    const response = (await proxy(req)) as Response;

    const manifest = (response.headers.get("x-middleware-override-headers") ?? "")
      .split(",")
      .map((s) => s.trim());
    expect(manifest).toContain("x-next-intl-locale");
    expect(manifest).toContain("x-workos-session");
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("ar");
    expect(response.headers.get("set-cookie")).toContain("wos-session=abc");
  });
});
