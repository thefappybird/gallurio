import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { publicOrigin } from "./publicOrigin";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

describe("publicOrigin", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
  });

  it("prefers the configured NEXT_PUBLIC_APP_URL origin over the request's own origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://gallurio.com/";
    const req = new NextRequest("http://internal-upstream:3000/");

    expect(publicOrigin(req)).toBe("https://gallurio.com");
  });

  it("falls back to the request's own origin when NEXT_PUBLIC_APP_URL is unset", () => {
    const req = new NextRequest("http://localhost:3000/");

    expect(publicOrigin(req)).toBe("http://localhost:3000");
  });

  it("falls back to the request's own origin when NEXT_PUBLIC_APP_URL is malformed", () => {
    process.env.NEXT_PUBLIC_APP_URL = "not a url";
    const req = new NextRequest("http://localhost:3000/");

    expect(publicOrigin(req)).toBe("http://localhost:3000");
  });
});
