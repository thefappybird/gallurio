import { z } from "zod";
import { EVENT_TYPES } from "./booking";
import { wallTimeInTzToUtc, FALLBACK_TZ } from "@/lib/utils/timezone";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PREFERRED_CONTACT_METHODS = ["email", "phone", "either"] as const;
export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number];

// EVENT_TYPES is reused from the booking validator so an inquiry maps cleanly
// onto a Booking without an enum-translation layer. Do NOT redefine it here.
export { EVENT_TYPES } from "./booking";
export type { EventType } from "./booking";

// How far ahead an event may be requested. Guards against fat-fingered years
// (e.g. 2099) and bot spam with absurd dates.
const HORIZON_YEARS = 5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// ---------------------------------------------------------------------------
// Date-bound helpers (evaluated at parse time so "today" stays current)
// ---------------------------------------------------------------------------

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function horizonIso(): string {
  const d = new Date();
  const y = d.getFullYear() + HORIZON_YEARS;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Session schema — single-day, mirrors the booking wizard's session shape.
// Multiple sessions describe a multi-day shoot; each becomes one Booking
// sessions[] entry on approval.
// ---------------------------------------------------------------------------

export const inquirySessionSchema = z
  .object({
    startDate: z.string().regex(DATE_RE, "Invalid date"),
    startTime: z.string().regex(TIME_RE, "Invalid time"),
    endTime: z.string().regex(TIME_RE, "Invalid time"),
  })
  .refine((s) => s.endTime > s.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  })
  .refine((s) => s.startDate >= todayIso(), {
    message: "Date cannot be in the past",
    path: ["startDate"],
  })
  .refine((s) => s.startDate <= horizonIso(), {
    message: "Date is too far in the future",
    path: ["startDate"],
  });

export type InquirySessionInput = z.infer<typeof inquirySessionSchema>;

// ---------------------------------------------------------------------------
// Full submission schema — shared by the client form and (Phase 6) the API.
// ---------------------------------------------------------------------------

export const inquiryLocationSchema = z.object({
  label: z.string().trim().max(240).nullable(),
  address: z.string().trim().max(240).nullable(),
  placeId: z.string().trim().max(240).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

export const inquirySubmissionSchema = z.object({
  // Tab 1 — client info
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal("")),
  preferredContact: z.enum(PREFERRED_CONTACT_METHODS).default("email"),
  eventTitle: z.string().trim().min(2, "Please enter an event title").max(120),

  // Tab 2 — booking request
  sessions: z
    .array(inquirySessionSchema)
    .min(1, "Add at least one session")
    .max(20, "Too many sessions"),
  eventType: z.enum(EVENT_TYPES),
  location: inquiryLocationSchema,
  description: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(2000),

  // Anti-bot honeypot — must be empty.
  company_name: z.literal("").optional(),

  // Tracking (attached by the client from URL/referrer; no user-facing field).
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
  referrer: z.string().max(500).optional(),
});

export type InquirySubmissionInput = z.infer<typeof inquirySubmissionSchema>;

// ---------------------------------------------------------------------------
// Session conversion — inquiry sessions → Booking sessions[]
//
// Combines each `{ startDate, startTime/endTime }` into UTC instants using the
// workspace timezone (wall-clock semantics). Each inquiry session is single-day
// so startAt/endAt share the same calendar date — matching `bookingSessionSchema`.
// Used in tests now; consumed by the inquiry → booking flow (creates a Booking with status: "inquiry").
// ---------------------------------------------------------------------------

export function inquirySessionsToBookingSessions(
  sessions: InquirySessionInput[],
  timeZone: string = FALLBACK_TZ
): { startAt: Date; endAt: Date }[] {
  return sessions.map((s) => ({
    startAt: new Date(wallTimeInTzToUtc(s.startDate, s.startTime, timeZone)),
    endAt: new Date(wallTimeInTzToUtc(s.startDate, s.endTime, timeZone)),
  }));
}
