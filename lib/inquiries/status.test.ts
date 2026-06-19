import { describe, expect, it } from "vitest";
import {
  INQUIRY_STATUS_VALUES,
  getInquiryStatusLabelKey,
} from "@/lib/inquiries/status";

const VALID_KEYS = INQUIRY_STATUS_VALUES as readonly string[];

describe("getInquiryStatusLabelKey", () => {
  it.each(["new", "booked", "converted", "archived"])(
    "returns a valid statusValues key for known status '%s'",
    (status) => {
      const key = getInquiryStatusLabelKey(status);
      expect(VALID_KEYS).toContain(key);
    }
  );

  it("maps legacy 'approved' to 'booked'", () => {
    const key = getInquiryStatusLabelKey("approved");
    expect(key).toBe("booked");
    expect(VALID_KEYS).toContain(key);
  });

  it("returns a valid key for an unknown status (safe fallback)", () => {
    const key = getInquiryStatusLabelKey("someunknownstatus");
    expect(VALID_KEYS).toContain(key);
  });

  it("returns a valid key for null (safe fallback)", () => {
    const key = getInquiryStatusLabelKey(null);
    expect(VALID_KEYS).toContain(key);
  });

  it("returns a valid key for undefined (safe fallback)", () => {
    const key = getInquiryStatusLabelKey(undefined);
    expect(VALID_KEYS).toContain(key);
  });
});
