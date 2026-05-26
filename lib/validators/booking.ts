import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "./workspace";

export const BOOKING_STATUSES = [
  "inquiry",
  "quoted",
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
  phone: z.string().max(40).trim().optional().nullable(),
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
  });
export type BookingSessionInput = z.infer<typeof bookingSessionSchema>;

export const bookingCreateSchema = z.object({
  client: bookingClientSchema,
  title: z.string().min(1, "Required").max(160).trim(),
  eventType: z.enum(EVENT_TYPES).default("other"),
  status: z.enum(BOOKING_STATUSES).default("inquiry"),
  sessions: z
    .array(bookingSessionSchema)
    .min(1, "At least one session required"),
  location: z
    .object({
      address: z.string().max(240).trim().default(""),
    })
    .default({ address: "" }),
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
  "amount.total",
  "amount.deposit",
  "amount.currency",
  "notes",
  "clientName",
  "clientId",
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
    "amount.total": nonNegMoney.optional(),
    "amount.deposit": nonNegMoney.optional(),
    "amount.currency": z.enum(SUPPORTED_CURRENCIES).optional(),
    notes: z.string().max(2000).trim().optional(),
    clientName: z.string().min(1).max(120).trim().optional(),
    clientId: objectIdString.optional(),
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
