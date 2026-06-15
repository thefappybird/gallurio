import { describe, it, expect } from "vitest";
import {
  inquirySubmissionSchema,
  inquirySessionsToBookingSessions,
  inquirySessionsEditSchema,
} from "./inquiry";
import { bookingSessionSchema } from "./booking";

// ---------------------------------------------------------------------------
// Date helpers — compute relative to "now" so tests don't rot.
// ---------------------------------------------------------------------------

function isoOffsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FUTURE = isoOffsetDays(30);

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Ada Lovelace",
    email: "ADA@example.com",
    phone: "+63 900 000 0000",
    preferredContact: "email",
    eventTitle: "Ada & Charles Wedding",
    sessions: [{ startDate: FUTURE, startTime: "09:00", endTime: "17:00" }],
    eventType: "wedding",
    location: {
      label: "Manila Cathedral",
      address: "Manila, Metro Manila, Philippines",
      placeId: "place_123",
      lat: 14.5896,
      lng: 120.9747,
    },
    description: "Two-day wedding shoot, garden venue.",
    company_name: "",
    ...overrides,
  };
}

describe("inquirySubmissionSchema", () => {
  it("accepts a valid single-session payload and normalizes email", () => {
    const result = inquirySubmissionSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.eventTitle).toBe("Ada & Charles Wedding");
      expect(result.data.location.address).toBe("Manila, Metro Manila, Philippines");
    }
  });

  it("accepts a valid multi-session payload", () => {
    const result = inquirySubmissionSchema.safeParse(
      validPayload({
        sessions: [
          { startDate: FUTURE, startTime: "09:00", endTime: "12:00" },
          { startDate: isoOffsetDays(31), startTime: "14:00", endTime: "18:00" },
        ],
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(inquirySubmissionSchema.safeParse(validPayload({ email: "not-an-email" })).success).toBe(
      false
    );
  });

  it("rejects a missing name", () => {
    const p = validPayload();
    delete (p as Record<string, unknown>).name;
    expect(inquirySubmissionSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a missing event title", () => {
    expect(inquirySubmissionSchema.safeParse(validPayload({ eventTitle: "" })).success).toBe(false);
  });

  it("rejects an empty sessions array", () => {
    expect(inquirySubmissionSchema.safeParse(validPayload({ sessions: [] })).success).toBe(false);
  });

  it("rejects a past start date", () => {
    const result = inquirySubmissionSchema.safeParse(
      validPayload({
        sessions: [
          { startDate: isoOffsetDays(-2), startTime: "09:00", endTime: "17:00" },
        ],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a date more than 5 years out", () => {
    const result = inquirySubmissionSchema.safeParse(
      validPayload({
        sessions: [
          { startDate: isoOffsetDays(365 * 6), startTime: "09:00", endTime: "17:00" },
        ],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects endTime <= startTime", () => {
    const result = inquirySubmissionSchema.safeParse(
      validPayload({
        sessions: [
          { startDate: FUTURE, startTime: "17:00", endTime: "09:00" },
        ],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a too-short description", () => {
    expect(inquirySubmissionSchema.safeParse(validPayload({ description: "hi" })).success).toBe(
      false
    );
  });

  it("rejects a filled honeypot", () => {
    const result = inquirySubmissionSchema.safeParse(
      validPayload({ company_name: "Acme Corp" })
    );
    expect(result.success).toBe(false);
  });

  it("removes guestCount from the public inquiry payload shape", () => {
    const result = inquirySubmissionSchema.safeParse(validPayload({ guestCount: 120 }));
    expect(result.success).toBe(true);
    if (result.success) expect("guestCount" in result.data).toBe(false);
  });

  it("accepts an empty structured location", () => {
    const result = inquirySubmissionSchema.safeParse(
      validPayload({ location: { label: "", address: "", placeId: null, lat: null, lng: null } })
    );
    expect(result.success).toBe(true);
  });
});

describe("inquirySessionsToBookingSessions", () => {
  it("maps N inquiry sessions to N booking sessions that pass bookingSessionSchema", () => {
    const sessions = [
      { startDate: FUTURE, startTime: "09:00", endTime: "12:00" },
      { startDate: isoOffsetDays(31), startTime: "14:00", endTime: "18:00" },
    ];
    const out = inquirySessionsToBookingSessions(sessions, "Asia/Manila");
    expect(out).toHaveLength(2);
    for (const s of out) {
      const parsed = bookingSessionSchema.safeParse(s);
      expect(parsed.success).toBe(true);
    }
  });

  it("produces endAt after startAt on the same calendar day", () => {
    const [s] = inquirySessionsToBookingSessions(
      [{ startDate: FUTURE, startTime: "09:00", endTime: "17:00" }],
      "Asia/Manila"
    );
    expect(s.endAt.getTime()).toBeGreaterThan(s.startAt.getTime());
  });
});

describe("inquirySessionsEditSchema", () => {
  it("accepts valid sessions with phone and normalizes the phone field", () => {
    const result = inquirySessionsEditSchema.safeParse({
      sessions: [{ startDate: FUTURE, startTime: "09:00", endTime: "17:00" }],
      phone: "+63 900 000 0000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+63 900 000 0000");
      expect(result.data.sessions).toHaveLength(1);
    }
  });

  it("accepts valid sessions without phone", () => {
    const result = inquirySessionsEditSchema.safeParse({
      sessions: [{ startDate: FUTURE, startTime: "09:00", endTime: "17:00" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
    }
  });

  it("rejects a past date in sessions", () => {
    const result = inquirySessionsEditSchema.safeParse({
      sessions: [{ startDate: isoOffsetDays(-1), startTime: "09:00", endTime: "17:00" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects endTime before startTime", () => {
    const result = inquirySessionsEditSchema.safeParse({
      sessions: [{ startDate: FUTURE, startTime: "17:00", endTime: "09:00" }],
    });
    expect(result.success).toBe(false);
  });
});
