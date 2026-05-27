import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";
import { toastActionResult } from "./handleActionResult";

describe("toastActionResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls toast.success and returns true on success", () => {
    const result = toastActionResult({ ok: true }, "Saved successfully");
    expect(toast.success).toHaveBeenCalledWith("Saved successfully");
    expect(toast.error).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("calls toast.error with result.error and returns false on error", () => {
    const result = toastActionResult({ error: "Slug already taken" }, "Saved");
    expect(toast.error).toHaveBeenCalledWith("Slug already taken");
    expect(toast.success).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("calls toast.error with fallback string on null result and returns false", () => {
    const result = toastActionResult(null, "Saved");
    expect(toast.error).toHaveBeenCalledWith("Action failed — please try again");
    expect(toast.success).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("calls toast.error with fallback string on undefined result and returns false", () => {
    const result = toastActionResult(undefined, "Saved");
    expect(toast.error).toHaveBeenCalledWith("Action failed — please try again");
    expect(result).toBe(false);
  });

  it("calls toast.error with result.error even when ok is also present", () => {
    const result = toastActionResult({ ok: true, error: "Partial failure" }, "Saved");
    expect(toast.error).toHaveBeenCalledWith("Partial failure");
    expect(result).toBe(false);
  });
});
