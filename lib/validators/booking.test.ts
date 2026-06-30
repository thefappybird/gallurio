import { describe, expect, it } from "vitest";
import {
  bookingCreateSchema,
  bookingPatchSchema,
  bookingImportRowSchema,
  bookingSessionSchema,
  bookingClientSchema,
  BOOKING_STATUSES,
  EDITABLE_KEYS,
} from "./booking";

const validSession = {
  startAt: new Date("2026-08-15T10:00:00Z"),
  endAt: new Date("2026-08-15T18:00:00Z"),
};

const validCreate = {
  client: { mode: "new" as const, name: "Emma Carter", email: "emma@example.com" },
  teamId: "507f1f77bcf86cd799439011",
  title: "Carter Wedding",
  eventType: "wedding" as const,
  status: "booked" as const,
  sessions: [validSession],
  location: { address: "100 Ayala Ave" },
  amount: { total: 75_000, deposit: 25_000, currency: "PHP" as const },
  notes: "",
};

describe("bookingClientSchema (new-client phone shares client.ts E.164 rule)", () => {
  const base = { mode: "new" as const, name: "Emma Carter", email: "emma@example.com" };

  it("accepts a new client without a phone", () => {
    expect(bookingClientSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid E.164 phone", () => {
    expect(
      bookingClientSchema.safeParse({ ...base, phone: "+639171234567" }).success
    ).toBe(true);
  });

  it("trims surrounding whitespace before validating the phone", () => {
    const result = bookingClientSchema.safeParse({ ...base, phone: " +639171234567 " });
    expect(result.success).toBe(true);
    if (result.success && result.data.mode === "new") {
      expect(result.data.phone).toBe("+639171234567");
    }
  });

  it("rejects a non-E.164 phone (local format) — same as the clients flow", () => {
    expect(
      bookingClientSchema.safeParse({ ...base, phone: "09171234567" }).success
    ).toBe(false);
  });

  it("normalizes a blank phone to null", () => {
    const result = bookingClientSchema.safeParse({ ...base, phone: "" });
    expect(result.success).toBe(true);
    if (result.success && result.data.mode === "new") {
      expect(result.data.phone).toBeNull();
    }
  });
});

describe("bookingSessionSchema", () => {
  it("accepts a valid session", () => {
    expect(bookingSessionSchema.safeParse(validSession).success).toBe(true);
  });

  it("accepts a session where endAt equals startAt (same instant)", () => {
    const ok = bookingSessionSchema.safeParse({
      startAt: new Date("2026-08-15T10:00:00Z"),
      endAt: new Date("2026-08-15T10:00:00Z"),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects when endAt is before startAt", () => {
    const bad = bookingSessionSchema.safeParse({
      startAt: new Date("2026-08-15T10:00:00Z"),
      endAt: new Date("2026-08-15T09:00:00Z"),
    });
    expect(bad.success).toBe(false);
  });
});

describe("bookingCreateSchema", () => {
  it("accepts a valid payload with a single session and new-client mode", () => {
    expect(bookingCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it("accepts multiple sessions", () => {
    const ok = bookingCreateSchema.safeParse({
      ...validCreate,
      sessions: [
        { startAt: new Date("2026-08-15T10:00:00Z"), endAt: new Date("2026-08-15T18:00:00Z") },
        { startAt: new Date("2026-08-20T10:00:00Z"), endAt: new Date("2026-08-20T18:00:00Z") },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it("requires teamId — rejects a payload with no team", () => {
    const { teamId, ...noTeam } = validCreate;
    void teamId;
    expect(bookingCreateSchema.safeParse(noTeam).success).toBe(false);
  });

  it("rejects a malformed teamId (not a 24-char hex ObjectId)", () => {
    expect(bookingCreateSchema.safeParse({ ...validCreate, teamId: "not-an-id" }).success).toBe(
      false,
    );
  });

  it("rejects when sessions array is empty", () => {
    const bad = bookingCreateSchema.safeParse({ ...validCreate, sessions: [] });
    expect(bad.success).toBe(false);
  });

  it("accepts existing-client mode with a valid ObjectId", () => {
    const ok = bookingCreateSchema.safeParse({
      ...validCreate,
      client: { mode: "existing", clientId: "507f1f77bcf86cd799439011" },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects existing-client mode with a non-ObjectId string", () => {
    const bad = bookingCreateSchema.safeParse({
      ...validCreate,
      client: { mode: "existing", clientId: "not-an-id" },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects when deposit exceeds total", () => {
    const bad = bookingCreateSchema.safeParse({
      ...validCreate,
      amount: { total: 1000, deposit: 9999, currency: "PHP" },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a deposit when total is still zero", () => {
    const bad = bookingCreateSchema.safeParse({
      ...validCreate,
      amount: { total: 0, deposit: 1000, currency: "PHP" },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.path).toEqual(["amount", "deposit"]);
    }
  });

  it("rejects a session where endAt is before startAt", () => {
    const bad = bookingCreateSchema.safeParse({
      ...validCreate,
      sessions: [
        { startAt: new Date("2026-08-15T10:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it("rejects unsupported currency", () => {
    const bad = bookingCreateSchema.safeParse({
      ...validCreate,
      amount: { total: 1000, deposit: 0, currency: "JPY" },
    });
    expect(bad.success).toBe(false);
  });

  it("defaults location lat/lng to null when only an address is given", () => {
    const result = bookingCreateSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location.lat).toBeNull();
      expect(result.data.location.lng).toBeNull();
    }
  });

  it("accepts location with valid lat/lng coordinates", () => {
    const result = bookingCreateSchema.safeParse({
      ...validCreate,
      location: { address: "Manila", lat: 14.5995, lng: 120.9842 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location.lat).toBe(14.5995);
      expect(result.data.location.lng).toBe(120.9842);
    }
  });

  it("rejects out-of-range latitude (> 90)", () => {
    const bad = bookingCreateSchema.safeParse({
      ...validCreate,
      location: { address: "x", lat: 91, lng: 0 },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects out-of-range longitude (< -180)", () => {
    const bad = bookingCreateSchema.safeParse({
      ...validCreate,
      location: { address: "x", lat: 0, lng: -181 },
    });
    expect(bad.success).toBe(false);
  });
});

describe("bookingPatchSchema", () => {
  it("accepts a single editable key", () => {
    const ok = bookingPatchSchema.safeParse({ title: "Renamed" });
    expect(ok.success).toBe(true);
  });

  it("accepts multiple editable keys at once", () => {
    const ok = bookingPatchSchema.safeParse({
      title: "Renamed",
      status: "booked",
      "amount.total": 50_000,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a sessions array patch", () => {
    const ok = bookingPatchSchema.safeParse({
      sessions: [validSession],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an empty sessions array patch", () => {
    const bad = bookingPatchSchema.safeParse({ sessions: [] });
    expect(bad.success).toBe(false);
  });

  it("rejects an empty patch", () => {
    expect(bookingPatchSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    const bad = bookingPatchSchema.safeParse({ foo: "bar" });
    expect(bad.success).toBe(false);
  });

  it("rejects status outside the allowed enum", () => {
    const bad = bookingPatchSchema.safeParse({ status: "ghosted" });
    expect(bad.success).toBe(false);
  });

  it("accepts a teamId reassignment (valid ObjectId)", () => {
    const ok = bookingPatchSchema.safeParse({ teamId: "507f1f77bcf86cd799439011" });
    expect(ok.success).toBe(true);
  });

  it("rejects a malformed teamId", () => {
    expect(bookingPatchSchema.safeParse({ teamId: "nope" }).success).toBe(false);
  });

  it("accepts location.lat / location.lng patches", () => {
    expect(bookingPatchSchema.safeParse({ "location.lat": 14.6 }).success).toBe(true);
    expect(bookingPatchSchema.safeParse({ "location.lng": 120.98 }).success).toBe(true);
    expect(bookingPatchSchema.safeParse({ "location.lat": null }).success).toBe(true);
  });

  it("rejects an out-of-range location.lat patch", () => {
    expect(bookingPatchSchema.safeParse({ "location.lat": 200 }).success).toBe(false);
  });

  it("accepts every key listed in EDITABLE_KEYS individually", () => {
    const samples: Record<string, unknown> = {
      title: "x",
      eventType: "wedding",
      status: "booked",
      sessions: [validSession],
      "location.address": "addr",
      "location.lat": 14.6,
      "location.lng": 120.98,
      "amount.total": 1,
      "amount.deposit": 0,
      "amount.currency": "PHP",
      notes: "n",
      clientName: "C",
    };
    for (const key of EDITABLE_KEYS) {
      expect(bookingPatchSchema.safeParse({ [key]: samples[key] }).success).toBe(true);
    }
  });

  it("accepts a deposit-only patch (total absent — editing existing booking that already has a total)", () => {
    const ok = bookingPatchSchema.safeParse({ "amount.deposit": 1000 });
    expect(ok.success).toBe(true);
  });

  it("rejects a deposit patch when total is explicitly set to 0 in the same patch", () => {
    const bad = bookingPatchSchema.safeParse({ "amount.deposit": 1000, "amount.total": 0 });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.path).toEqual(["amount.deposit"]);
      expect(bad.error.issues[0]?.message).toBe("Cannot add a deposit without setting a price");
    }
  });
});

describe("bookingImportRowSchema", () => {
  it("accepts a minimum valid row", () => {
    const ok = bookingImportRowSchema.safeParse({
      title: "Wedding",
      clientName: "Emma",
      clientEmail: "emma@example.com",
      startAt: "2026-08-15T10:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a row without clientEmail (email is optional)", () => {
    const ok = bookingImportRowSchema.safeParse({
      title: "Wedding",
      clientName: "Emma",
      startAt: "2026-08-15T10:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects amountDeposit > amountTotal", () => {
    const bad = bookingImportRowSchema.safeParse({
      title: "Wedding",
      clientName: "Emma",
      clientEmail: "emma@example.com",
      startAt: "2026-08-15T10:00:00Z",
      amountTotal: 100,
      amountDeposit: 200,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects amountDeposit when amountTotal is missing or zero", () => {
    const bad = bookingImportRowSchema.safeParse({
      title: "Wedding",
      clientName: "Emma",
      clientEmail: "emma@example.com",
      startAt: "2026-08-15T10:00:00Z",
      amountTotal: 0,
      amountDeposit: 200,
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.path).toEqual(["amountDeposit"]);
    }
  });

  it("lowercases client email on parse", () => {
    const parsed = bookingImportRowSchema.safeParse({
      title: "Wedding",
      clientName: "Emma",
      clientEmail: "EMMA@Example.COM",
      startAt: "2026-08-15T10:00:00Z",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.clientEmail).toBe("emma@example.com");
  });
});

describe("BOOKING_STATUSES — quoted removal regression", () => {
  it("does not include the removed 'quoted' status", () => {
    expect(BOOKING_STATUSES).not.toContain("quoted");
  });

  it("contains exactly the three expected statuses in order", () => {
    expect([...BOOKING_STATUSES]).toEqual(["booked", "completed", "cancelled"]);
  });

  it("bookingCreateSchema rejects status: 'quoted'", () => {
    const result = bookingCreateSchema.safeParse({
      ...validCreate,
      status: "quoted",
    });
    expect(result.success).toBe(false);
  });

  it("bookingPatchSchema rejects status: 'quoted'", () => {
    const result = bookingPatchSchema.safeParse({ status: "quoted" });
    expect(result.success).toBe(false);
  });
});
