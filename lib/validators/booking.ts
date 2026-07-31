import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "./workspace";
import { clientFormSchema } from "./client";

export const BOOKING_STATUSES = [
  "booked",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export const BOOKING_PAYMENT_METHODS = ["cash", "card", "remit"] as const;

export const EVENT_TYPES = [
  "wedding",
  "corporate",
  "portrait",
  "engagement",
  "anniversary",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const isoDate = z.preprocess(
  (v) => (typeof v === "string" || v instanceof Date ? new Date(v) : v),
  z.date({ invalid_type_error: "Invalid date" })
);
const nonNegMoney = z.number().nonnegative("Must be 0 or more");
export const DEPOSIT_REQUIRES_TOTAL_MESSAGE = "Cannot add a deposit without setting a price";
const DEPOSIT_EXCEEDS_TOTAL_MESSAGE = "Deposit cannot exceed total";

export const bookingPaymentSchema = z.object({
  price: nonNegMoney,
  status: z.enum(BOOKING_PAYMENT_STATUSES),
  createdAt: isoDate.optional(),
  paidAt: isoDate.nullable().optional(),
  title: z.string().max(120).trim().default(""),
  method: z.enum(BOOKING_PAYMENT_METHODS).default("cash"),
});

const clientExistingBlock = z.object({
  mode: z.literal("existing"),
  clientId: objectIdString,
});
// Keep booking-wizard client creation in lockstep with the Clients "Add client"
// form: same contact validation plus source, tags, and notes.
const clientNewBlock = clientFormSchema.extend({ mode: z.literal("new") });
export const bookingClientSchema = z.discriminatedUnion("mode", [
  clientExistingBlock,
  clientNewBlock,
]);
export type BookingClientInput = z.infer<typeof bookingClientSchema>;

export const bookingSessionSchema = z
  .object({
    startAt: isoDate,
    endAt: isoDate,
  })
  .refine((s) => s.endAt.getTime() >= s.startAt.getTime(), {
    message: "Session end must be on or after session start",
    path: ["endAt"],
  });
// NOTE: no UTC-day / same-day refine here. A cheap UTC-day check false-rejects
// legitimate same-workspace-day sessions that cross UTC midnight in
// positive-offset zones (e.g. Asia/Manila, UTC+8: 2026-07-19T22:00Z ->
// 2026-07-20T02:00Z is 06:00-10:00 PHT, one workspace day). Same-day
// enforcement is the job of the tz-aware `sessionsAreSameDayInTz` in
// lib/bookings/session-validation.ts, which every real caller (POST/PATCH
// /api/bookings, CSV import) already calls after this schema parses.
export type BookingSessionInput = z.infer<typeof bookingSessionSchema>;

export const bookingCreateSchema = z.object({
  client: bookingClientSchema,
  // Every new booking is worked by a team. The server additionally verifies the
  // team belongs to the workspace, is active, and the caller may write to it.
  teamId: objectIdString,
  title: z.string().min(1, "Required").max(160).trim(),
  eventType: z.enum(EVENT_TYPES).default("other"),
  status: z.enum(BOOKING_STATUSES).default("booked"),
  sessions: z
    .array(bookingSessionSchema)
    .min(1, "At least one session required"),
  location: z
    .object({
      address: z.string().max(240).trim().default(""),
      lat: z.number().min(-90).max(90).nullable().default(null),
      lng: z.number().min(-180).max(180).nullable().default(null),
    })
    .default({ address: "", lat: null, lng: null }),
  amount: z
    .object({
      total: nonNegMoney.default(0),
      deposit: nonNegMoney.default(0),
      currency: z.enum(SUPPORTED_CURRENCIES),
    })
    .refine((a) => a.deposit <= a.total, {
      message: DEPOSIT_EXCEEDS_TOTAL_MESSAGE,
      path: ["deposit"],
    })
    .refine((a) => a.deposit === 0 || a.total > 0, {
      message: DEPOSIT_REQUIRES_TOTAL_MESSAGE,
      path: ["deposit"],
    }),
  payments: z.array(bookingPaymentSchema).default([]),
  notes: z.string().max(2000).trim().default(""),
}).refine(
  (v) => {
    const sum = v.payments.reduce((s, p) => s + p.price, 0);
    return sum <= v.amount.total - v.amount.deposit + 0.005; // epsilon for float rounding
  },
  { message: "Payments exceed the remaining balance", path: ["payments"] }
);
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const EDITABLE_KEYS = [
  "title",
  "eventType",
  "status",
  "sessions",
  "location.address",
  "location.lat",
  "location.lng",
  "amount.total",
  "amount.deposit",
  "amount.currency",
  "payments",
  "notes",
  "clientName",
  "clientId",
  "teamId",
] as const;
export type EditableKey = (typeof EDITABLE_KEYS)[number];

export const bookingPatchSchema = z
  .object({
    title: z.string().min(1).max(160).trim().optional(),
    eventType: z.enum(EVENT_TYPES).optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
    sessions: z
      .array(bookingSessionSchema)
      .min(1, "At least one session required")
      .optional(),
    "location.address": z.string().max(240).trim().optional(),
    "location.lat": z.number().min(-90).max(90).nullable().optional(),
    "location.lng": z.number().min(-180).max(180).nullable().optional(),
    "amount.total": nonNegMoney.optional(),
    "amount.deposit": nonNegMoney.optional(),
    "amount.currency": z.enum(SUPPORTED_CURRENCIES).optional(),
    payments: z.array(bookingPaymentSchema).optional(),
    notes: z.string().max(2000).trim().optional(),
    clientName: z.string().min(1).max(120).trim().optional(),
    clientId: objectIdString.optional(),
    // Reassign the booking to a different team. The route validates the target
    // is active + writable by the caller (owner or lead of that team).
    teamId: objectIdString.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v["amount.deposit"] == null ||
      v["amount.deposit"] === 0 ||
      v["amount.total"] == null ||
      v["amount.total"] > 0,
    {
      message: DEPOSIT_REQUIRES_TOTAL_MESSAGE,
      path: ["amount.deposit"],
    }
  )
  .refine(
    (v) =>
      v["amount.deposit"] == null ||
      v["amount.total"] == null ||
      v["amount.deposit"] <= v["amount.total"],
    {
      message: DEPOSIT_EXCEEDS_TOTAL_MESSAGE,
      path: ["amount.deposit"],
    }
  )
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type BookingPatchInput = z.infer<typeof bookingPatchSchema>;

/**
 * A spreadsheet has no concept of an absent cell: every column in every row
 * arrives as a string, blank ones as "". `.optional()` only admits `undefined`,
 * so without this an empty optional cell is validated as if the user had typed
 * something — and every no-email or no-event-type row is rejected.
 */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

// CSV import row — headers normalized lower-case at parse time.
// clientEmail is optional: when provided, we try to match an existing client
// by email; when absent we create a new client by name.
export const bookingImportRowSchema = z
  .object({
    title: z.string().min(1, "title is required").max(160).trim(),
    clientName: z.string().min(1, "clientName is required").max(120).trim(),
    clientEmail: z.preprocess(
      blankToUndefined,
      z
        .string()
        .email("Invalid email")
        .toLowerCase()
        .trim()
        .optional()
        .nullable()
        .transform((v) => v || null)
    ),
    startAt: isoDate,
    endAt: z.preprocess(blankToUndefined, isoDate.nullable().optional()),
    eventType: z.preprocess(blankToUndefined, z.enum(EVENT_TYPES).optional()),
    status: z.preprocess(blankToUndefined, z.enum(BOOKING_STATUSES).optional()),
    locationAddress: z.string().max(240).trim().optional(),
    amountTotal: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      nonNegMoney.optional()
    ),
    amountDeposit: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      nonNegMoney.optional()
    ),
    currency: z.preprocess(blankToUndefined, z.enum(SUPPORTED_CURRENCIES).optional()),
    notes: z.string().max(2000).trim().optional(),
    // Round-trip identity columns emitted by the exporter. A bookingId turns
    // the row into an update, but it is only a hint — ownership is re-checked
    // against workspaceId server-side before anything is written.
    bookingId: z.string().trim().optional().transform((v) => v || undefined),
    clientId: z.string().trim().optional().transform((v) => v || undefined),
    sessionIndex: z.string().trim().optional(),
    clientPhone: z.string().trim().max(30).optional().transform((v) => v || undefined),
    locationLat: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().min(-90).max(90).optional()
    ),
    locationLng: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().min(-180).max(180).optional()
    ),
  })
  .refine(
    (v) => v.amountDeposit == null || v.amountDeposit === 0 || (v.amountTotal ?? 0) > 0,
    { message: DEPOSIT_REQUIRES_TOTAL_MESSAGE, path: ["amountDeposit"] }
  )
  .refine(
    (v) => v.amountDeposit == null || v.amountTotal == null || v.amountDeposit <= v.amountTotal,
    { message: DEPOSIT_EXCEEDS_TOTAL_MESSAGE, path: ["amountDeposit"] }
  )
  .refine(
    (v) => !v.endAt || v.endAt.getTime() >= v.startAt.getTime(),
    { message: "End must be on or after start", path: ["endAt"] }
  );
export type BookingImportRowInput = z.infer<typeof bookingImportRowSchema>;
