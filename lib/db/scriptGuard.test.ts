import { describe, expect, it, vi } from "vitest";
import { assertSafeTarget, parseDbTarget, printDbFingerprint } from "./scriptGuard";

describe("parseDbTarget", () => {
  it("strips credentials from an SRV Atlas URI", () => {
    const target = parseDbTarget(
      "mongodb+srv://dbuser:s3cr3t@cluster0.abcde.mongodb.net/gallurio_prod?retryWrites=true&w=majority"
    );
    expect(target).toEqual({ host: "cluster0.abcde.mongodb.net", dbName: "gallurio_prod" });
    expect(JSON.stringify(target)).not.toContain("dbuser");
    expect(JSON.stringify(target)).not.toContain("s3cr3t");
  });
});

describe("printDbFingerprint", () => {
  it("never prints credentials or the query string", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printDbFingerprint(
      "mongodb+srv://dbuser:s3cr3t@cluster0.abcde.mongodb.net/gallurio_prod?retryWrites=true&w=majority"
    );
    const logged = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("cluster0.abcde.mongodb.net");
    expect(logged).toContain("gallurio_prod");
    expect(logged).not.toContain("dbuser");
    expect(logged).not.toContain("s3cr3t");
    expect(logged).not.toContain("retryWrites");
    logSpy.mockRestore();
  });
});

describe("assertSafeTarget", () => {
  it("throws on a localhost/dev-named target without --allow-dev", () => {
    expect(() =>
      assertSafeTarget("mongodb://localhost:27017/gallurio_dev", { argv: [], env: {} })
    ).toThrow(/dev-looking target/i);
  });

  it("passes a dev target when --allow-dev is given", () => {
    expect(() =>
      assertSafeTarget("mongodb://localhost:27017/gallurio_dev", {
        argv: ["--allow-dev"],
        env: {},
      })
    ).not.toThrow();
  });

  it("throws on a production-looking target without confirmation", () => {
    expect(() =>
      assertSafeTarget(
        "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/gallurio_prod",
        { argv: [], env: {} }
      )
    ).toThrow(/production-looking target/i);
  });

  it("passes a production-looking target with --i-understand-production", () => {
    expect(() =>
      assertSafeTarget(
        "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/gallurio_prod",
        { argv: ["--i-understand-production"], env: {} }
      )
    ).not.toThrow();
  });

  it("passes a production-looking target with CONFIRM_PRODUCTION=1", () => {
    expect(() =>
      assertSafeTarget(
        "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/gallurio_prod",
        { argv: [], env: { CONFIRM_PRODUCTION: "1" } }
      )
    ).not.toThrow();
  });

  it("does not throw on --dry-run against an unconfirmed production target", () => {
    expect(() =>
      assertSafeTarget(
        "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/gallurio_prod",
        { argv: ["--dry-run"], env: {} }
      )
    ).not.toThrow();
  });
});
