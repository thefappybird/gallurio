// Node environment (not the project-wide happy-dom default) is required here:
// happy-dom's fetch Headers implementation silently strips the "Host" header
// as a forbidden request header, which breaks the Host-header-driven tenant
// subdomain tests below. Node's Request/Headers do not enforce that filter.
// @vitest-environment node
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

  it("leaves the crawler-facing files and article routes unauthenticated", async () => {
    await import("./proxy");

    // The matcher does not exclude .txt or .xml, so these must be listed
    // explicitly — otherwise a crawler asking for robots.txt is redirected to
    // /sign-in and indexes nothing.
    expect(authkitMiddlewareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        middlewareAuth: expect.objectContaining({
          unauthenticatedPaths: expect.arrayContaining([
            "/robots.txt",
            "/sitemap.xml",
            "/llms.txt",
            "/compare",
            "/compare/(.*)",
            "/blog",
            "/blog/(.*)",
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

  it("bypasses AuthKit and intl for /opengraph-image (root metadata route, not locale-prefixed)", async () => {
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/opengraph-image");

    await proxy(req);

    expect(authMiddlewareMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("does not run AuthKit on public localized pages", async () => {
    const { proxy } = await import("./proxy");
    const req = new NextRequest("http://localhost/en/sign-in");

    await proxy(req);

    expect(authMiddlewareMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["/fil/blog", "/blog"],
    ["/id/blog/how-to-price", "/blog/how-to-price"],
    ["/ar/compare/gallurio-vs-wix?ref=nav", "/compare/gallurio-vs-wix?ref=nav"],
    ["/th/resources", "/resources"],
  ])("permanently redirects English-only editorial route %s to %s", async (path, expected) => {
    const { proxy } = await import("./proxy");

    const response = (await proxy(new NextRequest(`http://localhost${path}`))) as Response;

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`http://localhost${expected}`);
    expect(authMiddlewareMock).not.toHaveBeenCalled();
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
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

  describe("*.gallurio.com tenant subdomain routing", () => {
    function withBaseDomain(fn: () => Promise<void>): Promise<void> {
      const previous = process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN;
      const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN = "gallurio.com";
      // Mirror the internal app port present behind the production proxy. The
      // canonical public redirect must always omit it from the browser URL.
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      return fn().finally(() => {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN;
        else process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN = previous;
        if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
      });
    }

    it("rewrites a tenant subdomain host to /w/{slug}{pathname} and skips AuthKit + intl", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/gallery?tab=1", {
          headers: { host: "acme.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(authMiddlewareMock).not.toHaveBeenCalled();
        expect(intlMiddlewareMock).not.toHaveBeenCalled();
        const rewriteTarget = response.headers.get("x-middleware-rewrite");
        expect(rewriteTarget).not.toBeNull();
        const rewriteUrl = new URL(rewriteTarget!);
        expect(rewriteUrl.pathname).toBe("/w/acme/gallery");
        expect(rewriteUrl.searchParams.get("tab")).toBe("1");
      }));

    it("rewrites the visible tenant /home route to the internal portfolio home route", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/home?ref=nav", {
          headers: { host: "acme.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        const rewriteTarget = response.headers.get("x-middleware-rewrite");
        expect(rewriteTarget).not.toBeNull();
        const rewriteUrl = new URL(rewriteTarget!);
        expect(rewriteUrl.pathname).toBe("/w/acme");
        expect(rewriteUrl.searchParams.get("ref")).toBe("nav");
      }));

    it("does not rewrite on the canonical apex or www host (normal public-route flow continues)", () =>
      withBaseDomain(async () => {
        for (const host of ["gallurio.com", "www.gallurio.com"]) {
          authMiddlewareMock.mockClear();
          intlMiddlewareMock.mockClear();
          const { proxy } = await import("./proxy");
          const req = new NextRequest("http://localhost/pricing", { headers: { host } });

          const response = (await proxy(req)) as Response;

          expect(response.headers.get("x-middleware-rewrite"), `host ${host}`).toBeNull();
          expect(intlMiddlewareMock, `host ${host}`).toHaveBeenCalledTimes(1);
        }
      }));

    it("301-redirects /w/{slug}{subpath} on the canonical host to the tenant subdomain", () =>
      withBaseDomain(async () => {
        for (const host of ["gallurio.com", "www.gallurio.com"]) {
          authMiddlewareMock.mockClear();
          intlMiddlewareMock.mockClear();
          const { proxy } = await import("./proxy");
          const req = new NextRequest("http://localhost/w/acme/gallery?ref=ig", {
            headers: { host },
          });

          const response = (await proxy(req)) as Response;

          expect(response.status, `host ${host}`).toBe(301);
          expect(response.headers.get("location"), `host ${host}`).toBe(
            "https://acme.gallurio.com/gallery?ref=ig",
          );
          expect(authMiddlewareMock, `host ${host}`).not.toHaveBeenCalled();
          expect(intlMiddlewareMock, `host ${host}`).not.toHaveBeenCalled();
        }
      }));

    it("301-redirects the canonical /w home route to the tenant root", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/w/acme?ref=nav", {
          headers: { host: "gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.status).toBe(301);
        expect(response.headers.get("location")).toBe(
          "https://acme.gallurio.com/?ref=nav",
        );
      }));

    it("does not rewrite a reserved infra subdomain (e.g. dev.gallurio.com) to /w/{label}", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/", {
          headers: { host: "dev.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      }));

    it("still rewrites a normal (non-reserved) tenant subdomain to /w/{slug}", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/", {
          headers: { host: "banaag.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        const rewriteTarget = response.headers.get("x-middleware-rewrite");
        expect(rewriteTarget).not.toBeNull();
        expect(new URL(rewriteTarget!).pathname).toBe("/w/banaag");
      }));

    it("does not 301-redirect /w/{reserved-label} on the canonical host", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/w/dev", {
          headers: { host: "gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.status).not.toBe(301);
      }));

    it("still 301-redirects /w/{normal-slug} on the canonical host", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/w/banaag", {
          headers: { host: "gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.status).toBe(301);
        expect(response.headers.get("location")).toBe("https://banaag.gallurio.com/");
      }));

    it("still 301-redirects a valid multi-part slug like banaag-studio", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/w/banaag-studio", {
          headers: { host: "gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.status).toBe(301);
        expect(response.headers.get("location")).toBe("https://banaag-studio.gallurio.com/");
      }));

    it("does not 301-redirect an adversarial /w/ path segment that could hijack the redirect host (open redirect)", () =>
      withBaseDomain(async () => {
        const adversarial = [
          "/w/evil.com:1/foo",
          "/w/evil.com:80/foo",
          "/w/..",
          "/w/%2e%2e",
          "/w/a%2fb",
        ];
        for (const path of adversarial) {
          const { proxy } = await import("./proxy");
          const req = new NextRequest(`http://localhost${path}`, {
            headers: { host: "gallurio.com" },
          });

          const response = (await proxy(req)) as Response;

          expect(response.status, `path ${path}`).not.toBe(301);
          const location = response.headers.get("location");
          if (location) {
            const host = new URL(location).host;
            expect(host.endsWith(".gallurio.com"), `path ${path} location host ${host}`).toBe(true);
          }
        }
      }));

    it("does not loop: a tenant subdomain requesting a literal /w/ path falls to the existing /w/ bypass", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/w/other-slug", {
          headers: { host: "acme.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.headers.get("x-middleware-rewrite")).toBeNull();
        expect(authMiddlewareMock).not.toHaveBeenCalled();
        expect(intlMiddlewareMock).not.toHaveBeenCalled();
      }));

    it("rewrites a tenant subdomain's /robots.txt to /w/{slug}/robots.txt", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/robots.txt", {
          headers: { host: "acme.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        const rewriteTarget = response.headers.get("x-middleware-rewrite");
        expect(rewriteTarget).not.toBeNull();
        expect(new URL(rewriteTarget!).pathname).toBe("/w/acme/robots.txt");
      }));

    it("rewrites a tenant subdomain's /sitemap.xml to /w/{slug}/sitemap.xml", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/sitemap.xml", {
          headers: { host: "acme.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        const rewriteTarget = response.headers.get("x-middleware-rewrite");
        expect(rewriteTarget).not.toBeNull();
        expect(new URL(rewriteTarget!).pathname).toBe("/w/acme/sitemap.xml");
      }));

    it("does not rewrite /robots.txt on the canonical apex host (falls through to the root handler)", () =>
      withBaseDomain(async () => {
        const { proxy } = await import("./proxy");
        const req = new NextRequest("http://localhost/robots.txt", {
          headers: { host: "gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.headers.get("x-middleware-rewrite")).toBeNull();
        expect(response.status).not.toBe(301);
      }));

    it("stamps the resolved slug onto PORTFOLIO_SLUG_HEADER on a tenant subdomain rewrite", () =>
      withBaseDomain(async () => {
        const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
        const req = new NextRequest("http://localhost/gallery", {
          headers: { host: "acme.gallurio.com" },
        });

        const response = (await proxy(req)) as Response;

        const manifest = (response.headers.get("x-middleware-override-headers") ?? "")
          .split(",")
          .map((s) => s.trim());
        expect(manifest).toContain(PORTFOLIO_SLUG_HEADER);
        expect(response.headers.get(`x-middleware-request-${PORTFOLIO_SLUG_HEADER}`)).toBe("acme");
      }));

    it("does not propagate a forged inbound PORTFOLIO_SLUG_HEADER on a tenant subdomain rewrite", () =>
      withBaseDomain(async () => {
        const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
        const req = new NextRequest("http://localhost/gallery", {
          headers: { host: "acme.gallurio.com", [PORTFOLIO_SLUG_HEADER]: "evil" },
        });

        const response = (await proxy(req)) as Response;

        expect(response.headers.get(`x-middleware-request-${PORTFOLIO_SLUG_HEADER}`)).toBe("acme");
      }));
  });

  describe("PORTFOLIO_SLUG_HEADER on the /w/ bypass", () => {
    it("sets the header to the requested slug on a direct /w/{slug} request", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/w/acme/gallery");

      const response = (await proxy(req)) as Response;

      const manifest = (response.headers.get("x-middleware-override-headers") ?? "")
        .split(",")
        .map((s) => s.trim());
      expect(manifest).toContain(PORTFOLIO_SLUG_HEADER);
      expect(response.headers.get(`x-middleware-request-${PORTFOLIO_SLUG_HEADER}`)).toBe("acme");
    });

    it("does not set the header for a bare /w request", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/w");

      const response = (await proxy(req)) as Response;

      const manifest = (response.headers.get("x-middleware-override-headers") ?? "")
        .split(",")
        .map((s) => s.trim());
      expect(manifest).not.toContain(PORTFOLIO_SLUG_HEADER);
      expect(response.headers.get(`x-middleware-request-${PORTFOLIO_SLUG_HEADER}`)).toBeNull();
    });

    it("does not propagate a forged inbound PORTFOLIO_SLUG_HEADER on an unrelated /w/ request", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/w/acme", {
        headers: { [PORTFOLIO_SLUG_HEADER]: "evil" },
      });

      const response = (await proxy(req)) as Response;

      expect(response.headers.get(`x-middleware-request-${PORTFOLIO_SLUG_HEADER}`)).toBe("acme");
    });

    it("lowercases a mixed-case /w/{Slug} path segment before stamping the header", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/w/Acme-Studio/gallery");

      const response = (await proxy(req)) as Response;

      expect(response.headers.get(`x-middleware-request-${PORTFOLIO_SLUG_HEADER}`)).toBe(
        "acme-studio",
      );
    });

    it("does not set the header for a reserved slug under /w/", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/w/dev");

      const response = (await proxy(req)) as Response;

      const manifest = (response.headers.get("x-middleware-override-headers") ?? "")
        .split(",")
        .map((s) => s.trim());
      expect(manifest).not.toContain(PORTFOLIO_SLUG_HEADER);
    });
  });

  describe("PORTFOLIO_SLUG_HEADER trust boundary — stripped once at proxy() entry", () => {
    it("strips a forged inbound header before AuthKit runs on the /api branch", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/api/health", {
        headers: { [PORTFOLIO_SLUG_HEADER]: "evil" },
      });

      await proxy(req);

      const calledReq = authMiddlewareMock.mock.calls[0]?.[0] as NextRequest;
      expect(calledReq.headers.get(PORTFOLIO_SLUG_HEADER)).toBeNull();
    });

    it("strips a forged inbound header on a root crawler-file path", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/robots.txt", {
        headers: { [PORTFOLIO_SLUG_HEADER]: "evil" },
      });

      const response = (await proxy(req)) as Response;

      expect(req.headers.get(PORTFOLIO_SLUG_HEADER)).toBeNull();
      expect(response.headers.get(`x-middleware-request-${PORTFOLIO_SLUG_HEADER}`)).toBeNull();
    });

    it("strips a forged inbound header on the editorial 308-redirect branch", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/en/blog", {
        headers: { [PORTFOLIO_SLUG_HEADER]: "evil" },
      });

      const response = (await proxy(req)) as Response;

      expect(response.status).toBe(308);
      expect(req.headers.get(PORTFOLIO_SLUG_HEADER)).toBeNull();
    });

    it("strips a forged inbound header before it reaches next-intl on a protected route", async () => {
      const { proxy, PORTFOLIO_SLUG_HEADER } = await import("./proxy");
      const req = new NextRequest("http://localhost/bookings", {
        headers: { [PORTFOLIO_SLUG_HEADER]: "evil" },
      });

      await proxy(req);

      const calledReq = intlMiddlewareMock.mock.calls[0]?.[0] as NextRequest;
      expect(calledReq.headers.get(PORTFOLIO_SLUG_HEADER)).toBeNull();
    });
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
