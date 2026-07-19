import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { getUserTimeFormat } from "@/lib/utils/get-user-time-format";
import { cookies } from "next/headers";

const mockCookies = vi.mocked(cookies);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserTimeFormat", () => {
  it("returns '24h' when cookie is absent", async () => {
    mockCookies.mockResolvedValue({ get: () => undefined } as never);
    expect(await getUserTimeFormat()).toBe("24h");
  });

  it("returns '12h' when cookie is '12h'", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "12h" }) } as never);
    expect(await getUserTimeFormat()).toBe("12h");
  });

  it("returns '24h' when cookie is '24h'", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "24h" }) } as never);
    expect(await getUserTimeFormat()).toBe("24h");
  });

  it("returns '24h' for unrecognised cookie value", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "3pm" }) } as never);
    expect(await getUserTimeFormat()).toBe("24h");
  });
});
