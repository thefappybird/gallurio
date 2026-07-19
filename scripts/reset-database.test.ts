import { describe, expect, it } from "vitest";
import { parseArgs, resetDatabase } from "./reset-database";

describe("reset database arguments", () => {
  it("requires an explicit reset confirmation for a live reset", () => {
    expect(parseArgs(["--allow-dev"])).toEqual({ dryRun: false, confirmed: false });
    expect(parseArgs(["--allow-dev", "--confirm-reset"])).toEqual({
      dryRun: false,
      confirmed: true,
    });
  });

  it("recognizes dry-run mode", () => {
    expect(parseArgs(["--dry-run"])).toEqual({ dryRun: true, confirmed: false });
  });

  it("rejects a URI without an explicit database name", async () => {
    await expect(
      resetDatabase({ dryRun: true, confirmed: false }, "mongodb+srv://user:password@cluster.example.com")
    ).rejects.toThrow(/without an explicit database name/i);
  });
});
