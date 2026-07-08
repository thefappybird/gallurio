import { describe, it, expect } from "vitest";
import { buildPdfFilename } from "./filename";

describe("buildPdfFilename", () => {
  it("builds an uppercase, sanitized invoice filename with the given date", () => {
    const result = buildPdfFilename({
      business: "Studio & Co.",
      customer: "Emma Carter",
      kind: "invoice",
      date: new Date("2026-07-05T00:00:00Z"),
    });
    expect(result).toBe("STUDIO-CO-EMMA-CARTER-INVOICE_2026-07-05.PDF");
  });
});
