import { describe, expect, it } from "vitest";
import { parseArgs } from "./allow-promo-redemption";

describe("allow promo redemption arguments", () => {
  it("parses the required support audit fields", () => {
    expect(
      parseArgs([
        "--workspace-id=507f1f77bcf86cd799439011",
        "--code=MONTHPRO2026",
        "--operator=support-123",
        "--reason=Billing correction",
        "--allow-dev",
      ])
    ).toEqual({
      workspaceId: "507f1f77bcf86cd799439011",
      code: "MONTHPRO2026",
      operator: "support-123",
      reason: "Billing correction",
      dryRun: false,
    });
  });

  it("recognizes dry-run mode", () => {
    expect(parseArgs(["--dry-run"])).toEqual({ dryRun: true });
  });
});
