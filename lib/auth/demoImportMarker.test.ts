import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...a: unknown[]) => mockGet(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  }),
}));

import { hasDemoImportMarker, consumeDemoImportMarker, DEMO_IMPORT_COOKIE } from "./demoImportMarker";

beforeEach(() => {
  mockGet.mockReset();
  mockDelete.mockReset();
});

describe("hasDemoImportMarker", () => {
  it("returns true when the marker cookie is present", async () => {
    mockGet.mockReturnValue({ value: "1" });
    expect(await hasDemoImportMarker()).toBe(true);
    expect(mockGet).toHaveBeenCalledWith(DEMO_IMPORT_COOKIE);
  });

  it("returns false when the marker cookie is absent", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await hasDemoImportMarker()).toBe(false);
  });
});

describe("consumeDemoImportMarker", () => {
  it("returns true and clears the cookie when the marker is present", async () => {
    mockGet.mockReturnValue({ value: "1" });
    expect(await consumeDemoImportMarker()).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith(DEMO_IMPORT_COOKIE);
  });

  it("returns false and does not touch the cookie jar when absent", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await consumeDemoImportMarker()).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
