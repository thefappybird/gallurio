import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "./workspace";
import { optionalPhone } from "./client";

export const BOOKING_STATUSES = [
  "booked",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

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

const clientExistingBlock = z.object({
  mode: z.literal("existing"),
  clientId: objectIdString,
});
const clientNewBlock = z.object({
  mode: z.literal("new"),
  name: z.string().min(1, "Required").max(120).trim(),
  email: z.string().email("Invalid email").toLowerCase().trim().optional().nullable(),
  phone: optionalPhone,
});
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
  })
  .refine(
    (s) => {
      // Best-effort UTC-day check: a cheap sanity guard for callers that do not
      // have workspace timezone context (e.g. unit tests, CSV import pre-check).
      // This catches the obvious "next-calendar-day in UTC" cases early.
      //
      // NOTE: this check is NOT the authoritative single-day enforcer.
      // Route handlers that know the workspace timezone MUST also call
      // `sessionsAreSameDayInTz` from `lib/bookings/session-validation.ts`,
      // which is the authoritative tz-aware check.  Without it, a Philippines
      // (UTC+8) booking of 21:00→02:00 wall-time passes this UTC check because
      // it maps to 13:00→18:00 UTC same day.
      return (
        s.startAt.getUTCFullYear() === s.endAt.getUTCFullYear() &&
        s.startAt.getUTCMonth() === s.endAt.getUTCMonth() &&
        s.startAt.getUTCDate() === s.endAt.getUTCDate()
      );
    },
    {
      message: "Session cannot span midnight",
      path: ["endAt"],
    }
  );
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
      message: "Deposit cannot exceed total",
      path: ["deposit"],
    }),
  notes: z.string().max(2000).trim().default(""),
});
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
    notes: z.string().max(2000).trim().optional(),
    clientName: z.string().min(1).max(120).trim().optional(),
    clientId: objectIdString.optional(),
    // Reassign the booking to a different team. The route validates the target
    // is active + writable by the caller (owner or lead of that team).
    teamId: objectIdString.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type BookingPatchInput = z.infer<typeof bookingPatchSchema>;

// CSV import row — headers normalized lower-case at parse time.
// clientEmail is optional: when provided, we try to match an existing client
// by email; when absent we create a new client by name.
export const bookingImportRowSchema = z
  .object({
    title: z.string().min(1, "title is required").max(160).trim(),
    clientName: z.string().min(1, "clientName is required").max(120).trim(),
    clientEmail: z
      .string()
      .email("Invalid email")
      .toLowerCase()
      .trim()
      .optional()
      .nullable()
      .transform((v) => v || null),
    startAt: isoDate,
    endAt: isoDate.nullable().optional(),
    eventType: z.enum(EVENT_TYPES).optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
    locationAddress: z.string().max(240).trim().optional(),
    amountTotal: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      nonNegMoney.optional()
    ),
    amountDeposit: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      nonNegMoney.optional()
    ),
    currency: z.enum(SUPPORTED_CURRENCIES).optional(),
    notes: z.string().max(2000).trim().optional(),
  })
  .refine(
    (v) => v.amountDeposit == null || v.amountTotal == null || v.amountDeposit <= v.amountTotal,
    { message: "Deposit cannot exceed total", path: ["amountDeposit"] }
  )
  .refine(
    (v) => !v.endAt || v.endAt.getTime() >= v.startAt.getTime(),
    { message: "End must be on or after start", path: ["endAt"] }
  );
export type BookingImportRowInput = z.infer<typeof bookingImportRowSchema>;
