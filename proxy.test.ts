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
});
