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

  it("runs AuthKit on the localized invite-accept page so error states can read the session", async () => {
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/en/invite/accept?error=email_mismatch");

    await proxy(req);

    expect(authMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the localized verify-email page public while applying locale routing", async () => {
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/en/verify-email");

    await proxy(req);

    // `email_verification_required` has a pending verification token, not an
    // authenticated WorkOS session. Running AuthKit here would redirect it
    // back to sign-in before the verification code can be entered.
    expect(authMiddlewareMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("configures public and self-authenticated APIs as unauthenticated paths", async () => {
    await import("./proxy");

    expect(authkitMiddlewareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        middlewareAuth: expect.objectContaining({
          unauthenticatedPaths: expect.arrayContaining([
            "/api/public/(.*)",
            "/api/health",
            "/api/cron/(.*)",
          ]),
        }),
      }),
    );
  });

  it("returns JSON 401 instead of leaking an authentication redirect to API fetches", async () => {
    const redirect = NextResponse.redirect(
      new URL("https://api.workos.com/user_management/authorize?client_id=test")
    );
    redirect.headers.append("set-cookie", "wos-session=; Max-Age=0; Path=/");
    authMiddlewareMock.mockResolvedValueOnce(redirect);

    const { proxy } = await import("./proxy");
    const response = (await proxy(
      new NextRequest("http://localhost:3000/api/bookings")
    )) as Response;

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("wos-session=");
    await expect(response.json()).resolves.toEqual({ error: "not_authenticated" });
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

  it("passes AuthKit's request context into next-intl for the marketing root", async () => {
    const authHeaders = new Headers({
      "x-workos-middleware": "true",
      "x-url": "http://localhost/",
    });
    authMiddlewareMock.mockResolvedValueOnce(
      NextResponse.next({ request: { headers: authHeaders } }),
    );

    const { proxy } = await import("./proxy");
    await proxy(new NextRequest("http://localhost/"));

    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
    const intlRequest = (intlMiddlewareMock.mock.calls as unknown as [[NextRequest]])[0][0];
    expect(intlRequest.headers.get("x-workos-middleware")).toBe("true");
    expect(intlRequest.headers.get("x-url")).toBe("http://localhost/");
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

  it("uses NEXT_PUBLIC_APP_URL for the browser-facing sign-in redirect", async () => {
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.gallurio.com/";
    try {
      authMiddlewareMock.mockResolvedValueOnce(
        NextResponse.redirect(new URL("http://localhost/sign-in")),
      );
      const { proxy } = await import("./proxy");

      const response = await proxy(new NextRequest("http://localhost/bookings"));

      expect((response as Response).headers.get("location")).toBe(
        "https://dev.gallurio.com/sign-in?returnTo=%2Fbookings",
      );
    } finally {
      if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
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
