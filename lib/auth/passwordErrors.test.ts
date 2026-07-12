import { describe, it, expect } from "vitest";
import { UnprocessableEntityException } from "@workos-inc/node";
import { isPasswordReusedError } from "./passwordErrors";

describe("isPasswordReusedError", () => {
  it("returns true when the WorkOS error mentions password reuse", () => {
    const err = new UnprocessableEntityException({
      requestID: "req_1",
      errors: [{ field: "password", code: "password_reused" }],
    });
    expect(isPasswordReusedError(err)).toBe(true);
  });

  it("returns false for an unrelated validation error", () => {
    const err = new UnprocessableEntityException({
      requestID: "req_1",
      errors: [{ field: "password", code: "password_too_short" }],
    });
    expect(isPasswordReusedError(err)).toBe(false);
  });

  it("returns false for a non-WorkOS error", () => {
    expect(isPasswordReusedError(new Error("invalid token"))).toBe(false);
  });
});
