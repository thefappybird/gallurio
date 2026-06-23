import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { resolveStoredCollectionView } from "./view-preferences.server";

const mockCookies = vi.mocked(cookies);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveStoredCollectionView", () => {
  it("prefers an explicit valid view over the cookie", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "table" }) } as never);

    await expect(
      resolveStoredCollectionView("calendar", "gallurio_bookings_view")
    ).resolves.toBe("calendar");
  });

  it("falls back to a valid stored cookie when the URL has no view", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "calendar" }) } as never);

    await expect(
      resolveStoredCollectionView(undefined, "gallurio_bookings_view")
    ).resolves.toBe("calendar");
  });

  it("falls back to table when the cookie is absent", async () => {
    mockCookies.mockResolvedValue({ get: () => undefined } as never);

    await expect(
      resolveStoredCollectionView(undefined, "gallurio_bookings_view")
    ).resolves.toBe("table");
  });

  it("falls back to table when the cookie value is invalid", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "grid" }) } as never);

    await expect(
      resolveStoredCollectionView(undefined, "gallurio_bookings_view")
    ).resolves.toBe("table");
  });
});
