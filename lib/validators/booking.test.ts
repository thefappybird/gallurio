import { describe, expect, it } from "vitest";
import {
  bookingCreateSchema,
  bookingPatchSchema,
  bookingImportRowSchema,
  bookingSessionSchema,
  bookingClientSchema,
  EDITABLE_KEYS,
} from "./booking";

const validSession = {
  startAt: new Date("2026-08-15T10:00:00Z"),
  endAt: new Date("2026-08-15T18:00:00Z"),
};

const validCreate = {
  client: { mode: "new" as const, name: "Emma Carter", email: "emma@example.com" },
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

  it("accepts every key listed in EDITABLE_KEYS individually", () => {
    const samples: Record<string, unknown> = {
      title: "x",
      eventType: "wedding",
      status: "booked",
      sessions: [validSession],
      "location.address": "addr",
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
