/**
 * Backfill script - inquiry data migrations.
 *
 * Runs three idempotent migrations in sequence:
 *
 *   1. eventDate backfill
 *      Inquiries created before eventDate was required may have null eventDate.
 *      Sets eventDate to the earliest session.startDate parsed as UTC midnight.
 *      Skips inquiries with no sessions (cannot determine a date).
 *
 *   2. "contacted" -> "booked" status rename
 *      Renames the legacy status value "contacted" to "booked" in bulk.
 *      Idempotent -- inquiries already set to "booked" are not touched.
 *
 *   3. "approved" -> "booked" status rename
 *      Renames the stale intermediate value "approved" (was briefly used as
 *      an intermediate step between "contacted" and "booked") to "booked".
 *      Idempotent -- inquiries already set to "booked" are not touched.
 *
 * Usage:
 *   pnpm backfill:inquiries
 *
 * Requires MONGODB_URI in .env.local or the environment.
 */

import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

loadEnv({ path: ".env.local" });
loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("[backfill] MONGODB_URI is not set.");
  process.exit(1);
}

// -- Inline minimal schema (avoids Next.js server-only imports) --------------

type SessionDoc = { startDate: string }; // "YYYY-MM-DD"

interface InquiryRaw {
  _id: mongoose.Types.ObjectId;
  eventDate: Date | null;
  sessions: SessionDoc[];
  status: string;
}

const inquirySchema = new mongoose.Schema<InquiryRaw>(
  {
    eventDate: { type: Date, default: null },
    sessions: [
      {
        startDate: String,
        startTime: String,
        endTime: String,
      },
    ],
    status: String,
  },
  { strict: false }
);

// -- Helpers ------------------------------------------------------------------

function earliestDateFromSessions(sessions: SessionDoc[]): Date | null {
  const dates = sessions
    .map((s) => s.startDate)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  const parsed = new Date(`${dates[0]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// -- Main --------------------------------------------------------------------

async function main() {
  await mongoose.connect(MONGODB_URI!);
  console.log("[backfill] Connected to MongoDB.");

  const Inquiry = mongoose.model<InquiryRaw>("Inquiry", inquirySchema);

  // -- Migration 1: eventDate backfill ---------------------------------------

  console.log("[backfill] Migration 1: eventDate backfill...");

  const noDate = await Inquiry.find({ eventDate: null }).lean();
  console.log(`[backfill]   Found ${noDate.length} inquiries with null eventDate.`);

  let eventDateFixed = 0;
  let eventDateSkipped = 0;

  for (const inquiry of noDate) {
    const earliest = earliestDateFromSessions(inquiry.sessions ?? []);
    if (!earliest) {
      console.warn(
        `[backfill]   SKIP ${inquiry._id} -- no sessions to derive a date from.`
      );
      eventDateSkipped += 1;
      continue;
    }
    await Inquiry.updateOne(
      { _id: inquiry._id, eventDate: null },
      { $set: { eventDate: earliest } }
    );
    eventDateFixed += 1;
  }

  console.log(
    `[backfill]   eventDate: fixed=${eventDateFixed}, skipped=${eventDateSkipped}`
  );

  // -- Migration 2: "contacted" -> "booked" rename ---------------------------

  console.log('[backfill] Migration 2: status "contacted" -> "booked"...');

  const result2 = await Inquiry.updateMany(
    { status: "contacted" },
    { $set: { status: "booked" } }
  );

  console.log(
    `[backfill]   contacted->booked: matched=${result2.matchedCount}, modified=${result2.modifiedCount}`
  );

  // -- Migration 3: "approved" -> "booked" rename ----------------------------

  console.log('[backfill] Migration 3: status "approved" -> "booked"...');

  const result3 = await Inquiry.updateMany(
    { status: "approved" },
    { $set: { status: "booked" } }
  );

  console.log(
    `[backfill]   approved->booked: matched=${result3.matchedCount}, modified=${result3.modifiedCount}`
  );

  await mongoose.disconnect();
  console.log("[backfill] Done.");
}

main().catch((err) => {
  console.error("[backfill] Fatal:", err);
  process.exit(1);
});
